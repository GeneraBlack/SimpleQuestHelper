use std::collections::HashMap;
use crate::models::{ModpackData, Recipe};
use serde_json::json;

pub fn generate_kubejs_startup(data: &ModpackData) -> String {
    let mut script = String::new();
    let is_v26 = data.target_version.as_deref().map_or(false, |v| v.contains("26") || v.starts_with("1.26"));
    
    let item_reg = if is_v26 { "StartupEvents.registry('minecraft:item', event => {\n" } else { "StartupEvents.registry('item', event => {\n" };
    let block_reg = if is_v26 { "StartupEvents.registry('minecraft:block', event => {\n" } else { "StartupEvents.registry('block', event => {\n" };

    script.push_str(item_reg);
    for item in &data.items {
        script.push_str(&format!("  event.create('{}').displayName('{}');\n", item.id, item.name));
    }
    script.push_str("});\n\n");

    script.push_str(block_reg);
    for block in &data.blocks {
        script.push_str(&format!("  event.create('{}').displayName('{}');\n", block.id, block.name));
    }
    script.push_str("});\n\n");

    script
}

pub fn generate_kubejs_lang(data: &ModpackData) -> String {
    let mut map = serde_json::Map::new();

    for item in &data.items {
        map.insert(format!("item.kubejs.{}", item.id), serde_json::Value::String(item.name.clone()));
    }

    for block in &data.blocks {
        map.insert(format!("block.kubejs.{}", block.id), serde_json::Value::String(block.name.clone()));
    }

    serde_json::to_string_pretty(&map).unwrap_or_else(|_| "{}".to_string())
}

pub fn generate_kubejs_server(data: &ModpackData) -> String {
    let mut script = String::new();
    
    // 1. Recipes & Recipe Removals
    script.push_str("ServerEvents.recipes(event => {\n");
    
    // Removed / Blacklisted Recipes
    for removal in &data.removed_recipes {
        if !removal.target.is_empty() {
            match removal.removal_type.as_str() {
                "output" => script.push_str(&format!("  event.remove({{ output: '{}' }});\n", removal.target)),
                "type" => script.push_str(&format!("  event.remove({{ type: '{}' }});\n", removal.target)),
                "id" => script.push_str(&format!("  event.remove({{ id: '{}' }});\n", removal.target)),
                "mod" => script.push_str(&format!("  event.remove({{ mod: '{}' }});\n", removal.target)),
                _ => script.push_str(&format!("  event.remove({{ output: '{}' }});\n", removal.target)),
            }
        }
    }

    // Recipe additions
    for recipe in &data.recipes {
        if recipe.recipe_type == "minecraft:crafting_shaped" && recipe.grid.is_some() {
            let grid = recipe.grid.as_ref().unwrap();
            let mut char_map: HashMap<String, char> = HashMap::new();
            let mut next_char = 'A';

            for item in grid {
                if !item.is_empty() && !char_map.contains_key(item) {
                    char_map.insert(item.clone(), next_char);
                    next_char = ((next_char as u8) + 1) as char;
                }
            }

            let mut row1 = String::new();
            let mut row2 = String::new();
            let mut row3 = String::new();
            let empty_str = String::new();

            for i in 0..3 {
                let it = grid.get(i).unwrap_or(&empty_str);
                row1.push(if it.is_empty() { ' ' } else { *char_map.get(it).unwrap_or(&' ') });
            }
            for i in 3..6 {
                let it = grid.get(i).unwrap_or(&empty_str);
                row2.push(if it.is_empty() { ' ' } else { *char_map.get(it).unwrap_or(&' ') });
            }
            for i in 6..9 {
                let it = grid.get(i).unwrap_or(&empty_str);
                row3.push(if it.is_empty() { ' ' } else { *char_map.get(it).unwrap_or(&' ') });
            }

            let output_item = recipe.outputs.first().map(|o| o.item.as_str()).unwrap_or("minecraft:air");
            let output_count = recipe.outputs.first().and_then(|o| o.count).unwrap_or(1);

            let mut key_defs = String::new();
            for (item, ch) in &char_map {
                key_defs.push_str(&format!("    {}: '{}',\n", ch, item));
            }

            let mut shaped_call = format!(
                "  event.shaped(Item.of('{}', {}), [\n    '{}',\n    '{}',\n    '{}'\n  ], {{\n{}}})",
                output_item, output_count, row1, row2, row3, key_defs
            );

            if let Some(stage) = &recipe.stage_required {
                shaped_call = format!("{}.stage('{}')", shaped_call, stage);
            }
            script.push_str(&format!("{};\n", shaped_call));
        } else {
            let custom_json = build_custom_recipe_json(recipe);
            let json_string = serde_json::to_string_pretty(&custom_json).unwrap();
            let mut recipe_call = format!("  event.custom({});\n", json_string.replace("\n", "\n  "));
            
            if let Some(stage) = &recipe.stage_required {
                recipe_call = format!("  event.custom({}).stage('{}');\n", json_string.replace("\n", "\n  "), stage);
            }

            script.push_str(&recipe_call);
        }
    }
    script.push_str("});\n\n");

    // 2. Tags
    script.push_str("ServerEvents.tags('item', event => {\n");
    for tag_group in &data.tags {
        for item in &tag_group.items {
            script.push_str(&format!("  event.add('{}', '{}');\n", tag_group.tag, item));
        }
    }
    script.push_str("});\n\n");

    // 3. Ore Generation removal
    if data.disable_vanilla_ores {
        script.push_str("WorldEvents.removeOres(event => {\n");
        script.push_str("  event.removeAll();\n");
        script.push_str("});\n\n");
    }

    // 4. Custom Loot Tables & Mob Drops
    if !data.custom_loot.is_empty() {
        script.push_str("LootEvents.modifiers(event => {\n");
        for loot in &data.custom_loot {
            let chance_str = if let Some(c) = loot.chance {
                format!(".randomChance({})", c)
            } else {
                "".to_string()
            };

            for drop in &loot.drops {
                let count = drop.count.unwrap_or(1);
                if loot.target_type == "block" {
                    script.push_str(&format!(
                        "  event.addBlockLootModifier('{}'){}.addLoot(Item.of('{}', {}));\n",
                        loot.target, chance_str, drop.item, count
                    ));
                } else {
                    script.push_str(&format!(
                        "  event.addEntityLootModifier('{}'){}.addLoot(Item.of('{}', {}));\n",
                        loot.target, chance_str, drop.item, count
                    ));
                }
            }
        }
        script.push_str("});\n\n");
    }

    // 5. Item & Block Restrictions (Stages Lock)
    if !data.item_restrictions.is_empty() {
        script.push_str("ItemEvents.rightClicked(event => {\n");
        for rest in data.item_restrictions.iter().filter(|r| !r.is_block) {
            script.push_str(&format!(
                "  if (event.item.id === '{}' && !event.player.stages.has('{}')) {{\n    event.player.tell('§cDu benötigst das Zeitalter \"{}\", um dieses Item zu nutzen!');\n    event.cancel();\n  }}\n",
                rest.target, rest.stage, rest.stage
            ));
        }
        script.push_str("});\n\n");

        script.push_str("BlockEvents.placed(event => {\n");
        for rest in data.item_restrictions.iter().filter(|r| r.is_block) {
            script.push_str(&format!(
                "  if (event.block.id === '{}' && !event.player.stages.has('{}')) {{\n    event.player.tell('§cDu benötigst das Zeitalter \"{}\", um diesen Block zu platzieren!');\n    event.cancel();\n  }}\n",
                rest.target, rest.stage, rest.stage
            ));
        }
        script.push_str("});\n\n");
    }

    // 6. Starter Inventory (PlayerEvents.loggedIn)
    if !data.starter_items.is_empty() {
        script.push_str("PlayerEvents.loggedIn(event => {\n");
        script.push_str("  if (!event.player.stages.has('sqh_started')) {\n");
        script.push_str("    event.player.stages.add('sqh_started');\n");
        for starter in &data.starter_items {
            let count = starter.count.unwrap_or(1);
            script.push_str(&format!("    event.player.give(Item.of('{}', {}));\n", starter.item, count));
        }
        script.push_str("  }\n");
        script.push_str("});\n\n");
    }

    script
}

pub fn generate_kubejs_client(data: &ModpackData) -> String {
    let mut script = String::new();
    
    // 1. JEI Hiding
    script.push_str("JEIEvents.hideItems(event => {\n");
    for item in &data.hidden_items {
        script.push_str(&format!("  event.hide('{}');\n", item));
    }
    for item in &data.items {
        if item.hide_in_jei.unwrap_or(false) {
            script.push_str(&format!("  event.hide('kubejs:{}');\n", item.id));
        }
    }
    script.push_str("});\n\n");

    // 2. Custom Item Tooltips & Lore
    let items_with_tooltips: Vec<&crate::models::CustomItem> = data.items.iter()
        .filter(|i| i.tooltip.as_ref().map(|t| !t.trim().is_empty()).unwrap_or(false))
        .collect();

    if !items_with_tooltips.is_empty() {
        script.push_str("ItemEvents.tooltip(event => {\n");
        for item in items_with_tooltips {
            if let Some(tip) = &item.tooltip {
                script.push_str(&format!(
                    "  event.add('kubejs:{}', Text.of('{}'));\n",
                    item.id, tip.replace('\'', "\\'")
                ));
            }
        }
        script.push_str("});\n\n");
    }

    script
}

fn build_custom_recipe_json(recipe: &Recipe) -> serde_json::Value {
    let mut root = serde_json::Map::new();
    root.insert("type".to_string(), json!(recipe.recipe_type));

    if let Some(data) = &recipe.additional_data {
        if let serde_json::Value::Object(map) = data {
            for (k, v) in map {
                root.insert(k.clone(), v.clone());
            }
        }
    }

    serde_json::Value::Object(root)
}

pub struct ChapterExport {
    pub filename: String,
    pub content: String,
}

pub fn generate_ftbquests_reward_tables(data: &ModpackData) -> Vec<ChapterExport> {
    let mut exports = Vec::new();

    for (idx, table) in data.reward_tables.iter().enumerate() {
        let safe_filename = table.id.replace(|c: char| !c.is_alphanumeric() && c != '_', "_").to_lowercase();
        let table_hex_id = generate_hex_id(&table.id, (idx + 100) as u64);
        let icon = if table.icon.is_empty() { "minecraft:chest" } else { &table.icon };

        let mut snbt = String::new();
        snbt.push_str("{\n");
        snbt.push_str(&format!("\tid: \"{}\"\n", table_hex_id));
        snbt.push_str(&format!("\torder_index: {}\n", idx));
        snbt.push_str(&format!("\ttitle: \"{}\"\n", escape_snbt_string(&table.title)));
        snbt.push_str(&format!("\ticon: \"{}\"\n", icon));

        if table.is_loot_crate {
            snbt.push_str("\tloot_crate: {\n");
            snbt.push_str(&format!("\t\tstring_id: \"{}\"\n", safe_filename));
            snbt.push_str("\t\tcolor: 16777215\n");
            snbt.push_str("\t\tdrops: {\n\t\t\tboss: 0\n\t\t\tmonster: 0\n\t\t\tpassive: 0\n\t\t}\n");
            snbt.push_str("\t}\n");
        }

        snbt.push_str("\trewards: [\n");
        for reward in &table.rewards {
            let count = reward.count.unwrap_or(1);
            let weight = reward.weight.unwrap_or(1);
            snbt.push_str(&format!("\t\t{{ item: \"{}\", count: {}, weight: {}.0f }}\n", reward.item, count, weight));
        }
        snbt.push_str("\t]\n");
        snbt.push_str("}\n");

        exports.push(ChapterExport {
            filename: format!("{}.snbt", safe_filename),
            content: snbt,
        });
    }

    exports
}

pub fn generate_ftbquests_chapters(data: &ModpackData) -> Vec<ChapterExport> {
    let mut exports = Vec::new();

    for (order_idx, chapter) in data.chapters.iter().enumerate() {
        let safe_filename = chapter.id.replace(|c: char| !c.is_alphanumeric() && c != '_', "_").to_lowercase();
        let chapter_hex_id = generate_hex_id(&chapter.id, order_idx as u64);
        let icon = if chapter.icon.is_empty() { "minecraft:book" } else { &chapter.icon };

        let mut snbt = String::new();
        snbt.push_str("{\n");
        snbt.push_str(&format!("\tid: \"{}\"\n", chapter_hex_id));
        snbt.push_str("\tgroup: \"\"\n");
        snbt.push_str(&format!("\torder_index: {}\n", order_idx));
        snbt.push_str(&format!("\tfilename: \"{}\"\n", safe_filename));
        snbt.push_str(&format!("\ttitle: \"{}\"\n", escape_snbt_string(&chapter.title)));
        snbt.push_str(&format!("\ticon: \"{}\"\n", icon));
        snbt.push_str("\tdefault_quest_shape: \"circle\"\n");
        snbt.push_str("\tdefault_hide_dependency_lines: false\n");
        snbt.push_str("\tquests: [\n");

        for (q_idx, quest) in chapter.quests.iter().enumerate() {
            let quest_hex_id = generate_hex_id(&quest.id, (order_idx * 1000 + q_idx + 1) as u64);
            let x_coord = (quest.x / 40.0 * 10.0).round() / 10.0;
            let y_coord = (quest.y / 40.0 * 10.0).round() / 10.0;

            snbt.push_str("\t\t{\n");
            snbt.push_str(&format!("\t\t\tid: \"{}\"\n", quest_hex_id));
            snbt.push_str(&format!("\t\t\tx: {:.1}d\n", x_coord));
            snbt.push_str(&format!("\t\t\ty: {:.1}d\n", y_coord));
            snbt.push_str(&format!("\t\t\ttitle: \"{}\"\n", escape_snbt_string(&quest.title)));
            
            if !quest.description.is_empty() {
                snbt.push_str("\t\t\tdescription: [\n");
                for line in quest.description.lines() {
                    snbt.push_str(&format!("\t\t\t\t\"{}\"\n", escape_snbt_string(line)));
                }
                snbt.push_str("\t\t\t]\n");
            }

            if !quest.dependencies.is_empty() {
                snbt.push_str("\t\t\tdependencies: [\n");
                for dep in &quest.dependencies {
                    let dep_hex = generate_hex_id(dep, 0);
                    snbt.push_str(&format!("\t\t\t\t\"{}\"\n", dep_hex));
                }
                snbt.push_str("\t\t\t]\n");
            }

            // Tasks
            snbt.push_str("\t\t\ttasks: [\n");
            for (t_idx, task) in quest.tasks.iter().enumerate() {
                let task_hex = generate_hex_id(&format!("{}_t{}", quest.id, t_idx), t_idx as u64);
                snbt.push_str("\t\t\t\t{\n");
                snbt.push_str(&format!("\t\t\t\t\tid: \"{}\"\n", task_hex));
                if task.task_type == "checkmark" {
                    snbt.push_str("\t\t\t\t\ttype: \"checkmark\"\n");
                    snbt.push_str("\t\t\t\t\ttitle: \"Checkmark\"\n");
                } else {
                    let item_id = task.item.as_deref().unwrap_or("minecraft:stone");
                    let count = task.count.unwrap_or(1);
                    snbt.push_str("\t\t\t\t\ttype: \"item\"\n");
                    snbt.push_str("\t\t\t\t\titem: {\n");
                    snbt.push_str(&format!("\t\t\t\t\t\tid: \"{}\"\n", item_id));
                    snbt.push_str(&format!("\t\t\t\t\t\tcount: {}\n", count));
                    snbt.push_str("\t\t\t\t\t}\n");
                }
                snbt.push_str("\t\t\t\t}\n");
            }
            snbt.push_str("\t\t\t]\n");

            // Rewards
            snbt.push_str("\t\t\trewards: [\n");
            for (r_idx, reward) in quest.rewards.iter().enumerate() {
                let reward_hex = generate_hex_id(&format!("{}_r{}", quest.id, r_idx), r_idx as u64);
                snbt.push_str("\t\t\t\t{\n");
                snbt.push_str(&format!("\t\t\t\t\tid: \"{}\"\n", reward_hex));
                if reward.reward_type == "stage" {
                    if let Some(stage) = &reward.stage {
                        snbt.push_str("\t\t\t\t\ttype: \"command\"\n");
                        snbt.push_str(&format!("\t\t\t\t\ttitle: \"Unlock Stage: {}\"\n", stage));
                        snbt.push_str("\t\t\t\t\ticon: \"minecraft:experience_bottle\"\n");
                        snbt.push_str(&format!("\t\t\t\t\tcommand: \"/gamestage add @p {}\"\n", stage));
                    }
                } else if reward.reward_type == "table" {
                    let table_id = reward.table_id.as_deref().unwrap_or("");
                    let table_hex = generate_hex_id(table_id, 100);
                    snbt.push_str("\t\t\t\t\ttype: \"choice\"\n");
                    snbt.push_str(&format!("\t\t\t\t\ttable_id: \"{}\"\n", table_hex));
                } else {
                    let item_id = reward.item.as_deref().unwrap_or("minecraft:apple");
                    let count = reward.count.unwrap_or(1);
                    snbt.push_str("\t\t\t\t\ttype: \"item\"\n");
                    snbt.push_str("\t\t\t\t\titem: {\n");
                    snbt.push_str(&format!("\t\t\t\t\t\tid: \"{}\"\n", item_id));
                    snbt.push_str(&format!("\t\t\t\t\t\tcount: {}\n", count));
                    snbt.push_str("\t\t\t\t\t}\n");
                }
                snbt.push_str("\t\t\t\t}\n");
            }
            snbt.push_str("\t\t\t]\n");

            snbt.push_str("\t\t}\n");
        }

        snbt.push_str("\t]\n");
        snbt.push_str("\tquest_links: [ ]\n");
        snbt.push_str("}\n");

        exports.push(ChapterExport {
            filename: format!("{}.snbt", safe_filename),
            content: snbt,
        });
    }

    exports
}

fn escape_snbt_string(input: &str) -> String {
    input.replace('\\', "\\\\").replace('"', "\\\"")
}

pub fn generate_hex_id(seed: &str, salt: u64) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    seed.hash(&mut hasher);
    salt.hash(&mut hasher);
    let hash_val = hasher.finish();

    format!("{:016X}", hash_val)
}
