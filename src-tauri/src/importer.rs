use std::fs;
use std::path::Path;
use std::collections::HashMap;
use crate::models::{
    ModpackData, QuestChapter, QuestNode, QuestTask, QuestReward, 
    RewardTable, RewardTableEntry, CustomItem, CustomBlock, Ingredient,
    Recipe, RecipeRemoval, ItemRestriction
};

pub fn import_from_instance(instance_path: &str) -> Result<(ModpackData, usize, usize), String> {
    let base = Path::new(instance_path);
    if !base.exists() {
        return Err(format!("Instance directory does not exist: {}", instance_path));
    }

    let mut chapters = Vec::new();
    let mut reward_tables = Vec::new();
    let mut custom_items = Vec::new();
    let mut custom_blocks = Vec::new();
    let mut recipes = Vec::new();
    let mut removed_recipes = Vec::new();
    let mut item_restrictions = Vec::new();
    let mut all_scanned_items = Vec::new();

    // 0. Load FTB Quests Localization (config/ftbquests/quests/lang/en_us.snbt & en_us.json)
    let mut lang_map = HashMap::new();
    let lang_dir = base.join("config").join("ftbquests").join("quests").join("lang");
    if lang_dir.exists() && lang_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&lang_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                let fname = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                if fname.starts_with("en_") && (fname.ends_with(".snbt") || fname.ends_with(".json")) {
                    if let Ok(content) = fs::read_to_string(&p) {
                        parse_lang_file(&content, &mut lang_map);
                    }
                }
            }
        }
    }

    // 1. Parse FTB Quests Chapters (config/ftbquests/quests/chapters/*.snbt)
    let chapters_dir = base.join("config").join("ftbquests").join("quests").join("chapters");
    if chapters_dir.exists() && chapters_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&chapters_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().map_or(false, |ext| ext == "snbt") {
                    if let Ok(content) = fs::read_to_string(&p) {
                        let filename = p.file_stem().unwrap_or_default().to_string_lossy().to_string();
                        if let Some(chapter) = parse_chapter_snbt(&content, &filename, &lang_map, &mut all_scanned_items) {
                            chapters.push(chapter);
                        }
                    }
                }
            }
        }
    }

    // 2. Parse FTB Quests Reward Tables (config/ftbquests/quests/reward_tables/*.snbt)
    let tables_dir = base.join("config").join("ftbquests").join("quests").join("reward_tables");
    if tables_dir.exists() && tables_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&tables_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().map_or(false, |ext| ext == "snbt") {
                    if let Ok(content) = fs::read_to_string(&p) {
                        let filename = p.file_stem().unwrap_or_default().to_string_lossy().to_string();
                        if let Some(table) = parse_reward_table_snbt(&content, &filename, &lang_map, &mut all_scanned_items) {
                            reward_tables.push(table);
                        }
                    }
                }
            }
        }
    }

    // 3. Scan Custom Items & Blocks from KubeJS startup_scripts
    let startup_dir = base.join("kubejs").join("startup_scripts");
    if startup_dir.exists() && startup_dir.is_dir() {
        scan_custom_items_from_js(&startup_dir, &mut custom_items, &mut custom_blocks, &mut all_scanned_items);
    }

    // 4. Scan Recipes, Recipe Removals & Restrictions from KubeJS server_scripts
    let server_dir = base.join("kubejs").join("server_scripts");
    if server_dir.exists() && server_dir.is_dir() {
        scan_recipes_from_scripts(&server_dir, &mut recipes, &mut removed_recipes, &mut item_restrictions, &mut all_scanned_items);
    }

    let num_quests: usize = chapters.iter().map(|c| c.quests.len()).sum();
    let num_chapters = chapters.len();

    let data = ModpackData {
        items: custom_items,
        blocks: custom_blocks,
        recipes,
        removed_recipes,
        item_restrictions,
        reward_tables,
        chapters,
        tags: Vec::new(),
        hidden_items: Vec::new(),
        disable_vanilla_ores: false,
        custom_loot: Vec::new(),
        starter_items: vec![Ingredient { item: "minecraft:book".to_string(), count: Some(1) }],
        stages: Vec::new(),
        custom_mechanics: vec![
            "minecraft:crafting_shaped".to_string(),
            "minecraft:crafting_shapeless".to_string(),
            "minecraft:smelting".to_string(),
            "minecraft:blasting".to_string(),
            "minecraft:smoking".to_string(),
        ],
        target_version: Some("1.21.1".to_string()),
    };

    Ok((data, num_chapters, num_quests))
}

fn parse_lang_file(content: &str, map: &mut HashMap<String, String>) {
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(colon_idx) = trimmed.find(':') {
            let key = trimmed[..colon_idx].trim().trim_matches('"');
            let val_part = trimmed[colon_idx + 1..].trim();
            if val_part.starts_with('"') {
                if let Some(end_quote) = val_part[1..].find('"') {
                    let val = &val_part[1..1 + end_quote];
                    map.insert(key.to_string(), clean_minecraft_formatting(val));
                }
            } else if val_part.starts_with('[') {
                // Multi-line array in SNBT
                let mut full_text = Vec::new();
                for part in val_part.split('"') {
                    let p = part.trim().trim_matches(|c| c == '[' || c == ']' || c == ',');
                    if !p.is_empty() {
                        full_text.push(clean_minecraft_formatting(p));
                    }
                }
                map.insert(key.to_string(), full_text.join("\n"));
            }
        }
    }
}

fn clean_minecraft_formatting(s: &str) -> String {
    let mut out = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if (c == '&' || c == '§') && chars.peek().is_some() {
            chars.next(); // Skip formatting code character
        } else {
            out.push(c);
        }
    }
    out.trim().to_string()
}

fn format_id_to_title(id: &str) -> String {
    let raw = if id.contains(':') {
        id.split(':').nth(1).unwrap_or(id)
    } else {
        id
    };
    raw.replace('_', " ")
        .split_whitespace()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_chapter_snbt(content: &str, filename: &str, lang_map: &HashMap<String, String>, scanned_items: &mut Vec<String>) -> Option<QuestChapter> {
    let id = extract_string_field(content, "id:").unwrap_or_else(|| filename.to_string());
    
    // Resolve Chapter Title: 1) lang_map `chapter.<ID>.title`, 2) explicit in SNBT, 3) filename
    let title = lang_map.get(&format!("chapter.{}.title", id))
        .cloned()
        .or_else(|| extract_string_field(content, "title:"))
        .unwrap_or_else(|| format_id_to_title(filename));

    let icon = extract_icon(content).unwrap_or_else(|| "minecraft:book".to_string());
    scanned_items.push(icon.clone());

    let mut quests = Vec::new();

    if let Some(quests_start) = content.find("quests: [") {
        let quests_sub = &content[quests_start + 9..];
        let quest_blocks = split_snbt_objects(quests_sub);

        for block in quest_blocks {
            if let Some(quest) = parse_single_quest(&block, lang_map, scanned_items) {
                quests.push(quest);
            }
        }
    }

    Some(QuestChapter {
        id,
        title,
        icon,
        quests,
    })
}

fn parse_single_quest(block: &str, lang_map: &HashMap<String, String>, scanned_items: &mut Vec<String>) -> Option<QuestNode> {
    let id = extract_string_field(block, "id:").unwrap_or_else(|| format!("quest_{}", fastrand_u64()));
    
    // 1. Extract Tasks
    let mut tasks = Vec::new();
    let mut first_item_id = None;
    if let Some(tasks_start) = block.find("tasks: [") {
        let tasks_sub = &block[tasks_start + 8..];
        let task_blocks = split_snbt_objects(tasks_sub);
        for tb in task_blocks {
            let ttype = extract_string_field(&tb, "type:").unwrap_or_else(|| "item".to_string());
            let item_id = extract_item_id_from_snbt(&tb);
            if let Some(ref it) = item_id {
                scanned_items.push(it.clone());
                if first_item_id.is_none() {
                    first_item_id = Some(it.clone());
                }
            }
            let count = extract_int_field(&tb, "count:").map(|c| c.max(1) as u32);
            tasks.push(QuestTask {
                task_type: ttype,
                item: item_id,
                count,
            });
        }
    }

    // 2. Extract Rewards
    let mut rewards = Vec::new();
    if let Some(rew_start) = block.find("rewards: [") {
        let rew_sub = &block[rew_start + 10..];
        let rew_blocks = split_snbt_objects(rew_sub);
        for rb in rew_blocks {
            let rtype = extract_string_field(&rb, "type:").unwrap_or_else(|| "item".to_string());
            let item_id = extract_item_id_from_snbt(&rb);
            if let Some(ref it) = item_id {
                scanned_items.push(it.clone());
            }
            let count = extract_int_field(&rb, "count:").map(|c| c.max(1) as u32);
            let stage = extract_string_field(&rb, "stage:");
            let table_id = extract_string_field(&rb, "table_id:").or_else(|| extract_string_field(&rb, "table:"));
            rewards.push(QuestReward {
                reward_type: rtype,
                item: item_id,
                count,
                stage,
                table_id,
            });
        }
    }

    // 3. Resolve Title: lang_map -> explicit in SNBT -> first task item name -> icon -> ID
    let title = lang_map.get(&format!("quest.{}.title", id))
        .cloned()
        .or_else(|| extract_string_field(block, "title:").map(|s| clean_minecraft_formatting(&s)))
        .or_else(|| first_item_id.as_ref().map(|it| format_id_to_title(it)))
        .unwrap_or_else(|| format_id_to_title(&id));

    // 4. Resolve Description: lang_map -> explicit in SNBT
    let description = lang_map.get(&format!("quest.{}.quest_desc", id))
        .cloned()
        .or_else(|| extract_description_from_snbt(block))
        .unwrap_or_default();

    let x = extract_coord(block, "x:").unwrap_or(0.0) * 45.0 + 300.0;
    let y = extract_coord(block, "y:").unwrap_or(0.0) * 45.0 + 200.0;

    let dependencies = extract_array_strings(block, "dependencies:");

    Some(QuestNode {
        id,
        title,
        description,
        dependencies,
        x,
        y,
        tasks,
        rewards,
    })
}

fn parse_reward_table_snbt(content: &str, filename: &str, lang_map: &HashMap<String, String>, scanned_items: &mut Vec<String>) -> Option<RewardTable> {
    let id = extract_string_field(content, "id:").unwrap_or_else(|| filename.to_string());
    
    let title = lang_map.get(&format!("reward_table.{}.title", id))
        .cloned()
        .or_else(|| extract_string_field(content, "title:").map(|s| clean_minecraft_formatting(&s)))
        .unwrap_or_else(|| format_id_to_title(filename));

    let icon = extract_icon(content).unwrap_or_else(|| "minecraft:chest".to_string());
    let is_loot_crate = content.contains("loot_crate:") && content.contains("true");

    let mut rewards = Vec::new();
    if let Some(rew_start) = content.find("rewards: [") {
        let rew_sub = &content[rew_start + 10..];
        let rew_blocks = split_snbt_objects(rew_sub);
        for rb in rew_blocks {
            let item_id = extract_item_id_from_snbt(&rb).unwrap_or_default();
            if !item_id.is_empty() {
                scanned_items.push(item_id.clone());
            }
            let count = extract_int_field(&rb, "count:").map(|c| c.max(1) as u32);
            let weight = extract_int_field(&rb, "weight:").map(|w| w.max(1) as u32);
            rewards.push(RewardTableEntry {
                item: item_id,
                count,
                weight,
            });
        }
    }

    Some(RewardTable {
        id,
        title,
        icon,
        is_loot_crate,
        rewards,
    })
}

fn extract_description_from_snbt(block: &str) -> Option<String> {
    if let Some(idx) = block.find("description: [") {
        let after = &block[idx + 14..];
        if let Some(end) = after.find(']') {
            let lines = &after[..end];
            let mut result = Vec::new();
            for part in lines.split('"') {
                let p = part.trim().trim_matches(|c| c == ',' || c == '[' || c == ']');
                if !p.is_empty() {
                    result.push(clean_minecraft_formatting(p));
                }
            }
            return Some(result.join("\n"));
        }
    }
    extract_string_field(block, "description:").map(|s| clean_minecraft_formatting(&s))
}

fn extract_string_field(text: &str, field: &str) -> Option<String> {
    let idx = text.find(field)?;
    let after = text[idx + field.len()..].trim();
    if after.starts_with('"') {
        let quote_end = after[1..].find('"')?;
        return Some(after[1..1 + quote_end].to_string());
    }
    let token = after.split_whitespace().next()?;
    Some(token.trim_matches(|c| c == ',' || c == '"' || c == '{' || c == '}').to_string())
}

fn extract_int_field(text: &str, field: &str) -> Option<i32> {
    let idx = text.find(field)?;
    let after = text[idx + field.len()..].trim();
    let token = after.split(|c: char| c.is_whitespace() || c == ',' || c == '}').next()?;
    token.parse::<i32>().ok()
}

fn extract_coord(text: &str, field: &str) -> Option<f64> {
    let idx = text.find(field)?;
    let after = text[idx + field.len()..].trim();
    let token = after.split(|c: char| c.is_whitespace() || c == ',' || c == 'd' || c == '}').next()?;
    token.parse::<f64>().ok()
}

fn extract_icon(text: &str) -> Option<String> {
    if let Some(idx) = text.find("icon:") {
        let after = text[idx + 5..].trim();
        if after.starts_with('{') {
            return extract_string_field(after, "id:");
        }
        if after.starts_with('"') {
            let quote_end = after[1..].find('"')?;
            return Some(after[1..1 + quote_end].to_string());
        }
    }
    None
}

fn extract_item_id_from_snbt(text: &str) -> Option<String> {
    if let Some(idx) = text.find("item:") {
        let after = text[idx + 5..].trim();
        if after.starts_with('{') {
            return extract_string_field(after, "id:");
        }
        if after.starts_with('"') {
            let quote_end = after[1..].find('"')?;
            return Some(after[1..1 + quote_end].to_string());
        }
    }
    extract_string_field(text, "id:")
}

fn extract_array_strings(text: &str, field: &str) -> Vec<String> {
    let mut result = Vec::new();
    if let Some(idx) = text.find(field) {
        let after = text[idx + field.len()..].trim();
        if let Some(bracket_start) = after.find('[') {
            if let Some(bracket_end) = after[bracket_start..].find(']') {
                let inside = &after[bracket_start + 1..bracket_start + bracket_end];
                for part in inside.split(',') {
                    let cleaned = part.trim().trim_matches('"');
                    if !cleaned.is_empty() {
                        result.push(cleaned.to_string());
                    }
                }
            }
        }
    }
    result
}

fn split_snbt_objects(text: &str) -> Vec<String> {
    let mut objects = Vec::new();
    let mut depth = 0;
    let mut start_idx = None;

    for (i, c) in text.char_indices() {
        if c == '{' {
            if depth == 0 {
                start_idx = Some(i);
            }
            depth += 1;
        } else if c == '}' {
            if depth > 0 {
                depth -= 1;
                if depth == 0 {
                    if let Some(start) = start_idx {
                        objects.push(text[start..=i].to_string());
                        start_idx = None;
                    }
                }
            }
        } else if c == ']' && depth == 0 {
            break;
        }
    }

    objects
}

fn scan_custom_items_from_js(dir: &Path, items: &mut Vec<CustomItem>, _blocks: &mut Vec<CustomBlock>, scanned_items: &mut Vec<String>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() && p.extension().map_or(false, |ext| ext == "js") {
                if let Ok(content) = fs::read_to_string(&p) {
                    for line in content.lines() {
                        let trimmed = line.trim();
                        if trimmed.contains("event.create(") || trimmed.contains("add9x9rooms(") {
                            if let Some(start) = trimmed.find('(') {
                                if let Some(end) = trimmed[start..].find(')') {
                                    let args = &trimmed[start + 1..start + end];
                                    let first_arg = args.split(',').next().unwrap_or("").trim().trim_matches(|c| c == '\'' || c == '"' || c == '`');
                                    if !first_arg.is_empty() {
                                        let raw_id = if first_arg.contains(':') {
                                            first_arg.split(':').nth(1).unwrap_or(first_arg)
                                        } else {
                                            first_arg
                                        };
                                        let full_id = if first_arg.contains(':') { first_arg.to_string() } else { format!("kubejs:{}", first_arg) };
                                        scanned_items.push(full_id.clone());

                                        let display_name = format_id_to_title(raw_id);

                                        if !items.iter().any(|it| it.id == raw_id) {
                                            items.push(CustomItem {
                                                id: raw_id.to_string(),
                                                name: display_name,
                                                texture_path: None,
                                                stage_required: None,
                                                hide_in_jei: None,
                                                tooltip: None,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------
// KubeJS Recipe, Removal, and Restriction Parser
// -------------------------------------------------------------
fn scan_recipes_from_scripts(
    dir: &Path, 
    recipes: &mut Vec<Recipe>, 
    removed_recipes: &mut Vec<RecipeRemoval>, 
    item_restrictions: &mut Vec<ItemRestriction>,
    scanned_items: &mut Vec<String>
) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                scan_recipes_from_scripts(&p, recipes, removed_recipes, item_restrictions, scanned_items);
            } else if p.is_file() && p.extension().map_or(false, |ext| ext == "js") {
                if let Ok(content) = fs::read_to_string(&p) {
                    parse_single_recipe_file(&content, recipes, removed_recipes, item_restrictions, scanned_items);
                }
            }
        }
    }
}

fn parse_single_recipe_file(
    content: &str, 
    recipes: &mut Vec<Recipe>, 
    removed_recipes: &mut Vec<RecipeRemoval>, 
    _item_restrictions: &mut Vec<ItemRestriction>,
    scanned_items: &mut Vec<String>
) {
    // Clean comments
    let mut clean_content = String::new();
    let mut in_block_comment = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if in_block_comment {
            if let Some(idx) = trimmed.find("*/") {
                in_block_comment = false;
                clean_content.push_str(&trimmed[idx + 2..]);
                clean_content.push('\n');
            }
            continue;
        }
        if let Some(idx) = trimmed.find("/*") {
            clean_content.push_str(&trimmed[..idx]);
            clean_content.push('\n');
            if !trimmed[idx..].contains("*/") {
                in_block_comment = true;
            }
            continue;
        }
        if let Some(idx) = trimmed.find("//") {
            clean_content.push_str(&trimmed[..idx]);
            clean_content.push('\n');
            continue;
        }
        clean_content.push_str(line);
        clean_content.push('\n');
    }

    // 1. Extract all event.remove({ ... })
    let mut cursor = 0;
    while let Some(idx) = clean_content[cursor..].find("event.remove({") {
        let actual_start = cursor + idx + 13;
        if let Some(end_idx) = clean_content[actual_start..].find('}') {
            let obj = &clean_content[actual_start..actual_start + end_idx];
            for pair in obj.split(',') {
                let parts: Vec<&str> = pair.split(':').collect();
                if parts.len() >= 2 {
                    let k = parts[0].trim().trim_matches(|c| c == '\'' || c == '"' || c == ' ' || c == '\n');
                    let v = parts[1..].join(":").trim().trim_matches(|c| c == '\'' || c == '"' || c == '`' || c == ' ' || c == '\n').to_string();
                    if !v.is_empty() {
                        removed_recipes.push(RecipeRemoval {
                            target: v,
                            removal_type: k.to_string(),
                        });
                    }
                }
            }
            cursor = actual_start + end_idx + 1;
        } else {
            break;
        }
    }

    // 2. Parse statements ending with ')' or separated by ';' / newlines
    for line in clean_content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }

        // 2a. event.shaped
        if trimmed.contains("event.shaped(") {
            if let Some(recipe) = parse_event_shaped(trimmed, scanned_items) {
                recipes.push(recipe);
            }
            continue;
        }

        // 2b. event.shapeless
        if trimmed.contains("event.shapeless(") {
            if let Some(recipe) = parse_event_shapeless(trimmed, scanned_items) {
                recipes.push(recipe);
            }
            continue;
        }

        // 2c. event.smelting / blasting / smoking
        if trimmed.contains("event.smelting(") || trimmed.contains("event.blasting(") || trimmed.contains("event.smoking(") {
            if let Some(recipe) = parse_event_single_io(trimmed, scanned_items) {
                recipes.push(recipe);
            }
            continue;
        }

        // 2d. Helper functions: addPulverizerRecipe(output, input, count)
        if trimmed.contains("addPulverizerRecipe(") {
            if let Some(recipe) = parse_helper_recipe(trimmed, "oritech:pulverizer", scanned_items) {
                recipes.push(recipe);
            }
            continue;
        }

        // 2e. Helper functions: addFoundryRecipe(output, in1, in2, count)
        if trimmed.contains("addFoundryRecipe(") {
            if let Some(recipe) = parse_helper_foundry_recipe(trimmed, scanned_items) {
                recipes.push(recipe);
            }
            continue;
        }

        // 2f. Helper functions: addInscriberRecipe(output, bottom, middle, top)
        if trimmed.contains("addInscriberRecipe(") {
            if let Some(recipe) = parse_helper_inscriber_recipe(trimmed, scanned_items) {
                recipes.push(recipe);
            }
            continue;
        }
    }

    // 3. Scan event.recipes.<mod>.<mechanic>(...)
    parse_event_recipes_calls(&clean_content, recipes, scanned_items);
}

fn parse_helper_recipe(line: &str, mechanic: &str, scanned_items: &mut Vec<String>) -> Option<Recipe> {
    let start = line.find('(')? + 1;
    let end = line[start..].find(')')? + start;
    let args: Vec<&str> = line[start..end].split(',').map(|s| s.trim().trim_matches(|c| c == '\'' || c == '"' || c == '`')).collect();
    if args.len() >= 2 {
        let output = args[0];
        let input = args[1];
        let count = args.get(2).and_then(|c| c.parse::<u32>().ok()).unwrap_or(1);
        if !output.is_empty() && !input.is_empty() {
            scanned_items.push(output.to_string());
            scanned_items.push(input.to_string());
            return Some(Recipe {
                recipe_type: mechanic.to_string(),
                inputs: vec![Ingredient { item: input.to_string(), count: Some(1) }],
                outputs: vec![Ingredient { item: output.to_string(), count: Some(count) }],
                grid: None,
                additional_data: None,
                stage_required: None,
            });
        }
    }
    None
}

fn parse_helper_foundry_recipe(line: &str, scanned_items: &mut Vec<String>) -> Option<Recipe> {
    let start = line.find('(')? + 1;
    let end = line[start..].find(')')? + start;
    let args: Vec<&str> = line[start..end].split(',').map(|s| s.trim().trim_matches(|c| c == '\'' || c == '"' || c == '`')).collect();
    if args.len() >= 3 {
        let output = args[0];
        let in1 = args[1];
        let in2 = args[2];
        let count = args.get(3).and_then(|c| c.parse::<u32>().ok()).unwrap_or(1);
        if !output.is_empty() && !in1.is_empty() && !in2.is_empty() {
            scanned_items.push(output.to_string());
            scanned_items.push(in1.to_string());
            scanned_items.push(in2.to_string());
            return Some(Recipe {
                recipe_type: "oritech:foundry".to_string(),
                inputs: vec![
                    Ingredient { item: in1.to_string(), count: Some(1) },
                    Ingredient { item: in2.to_string(), count: Some(1) },
                ],
                outputs: vec![Ingredient { item: output.to_string(), count: Some(count) }],
                grid: None,
                additional_data: None,
                stage_required: None,
            });
        }
    }
    None
}

fn parse_helper_inscriber_recipe(line: &str, scanned_items: &mut Vec<String>) -> Option<Recipe> {
    let start = line.find('(')? + 1;
    let end = line[start..].find(')')? + start;
    let args: Vec<&str> = line[start..end].split(',').map(|s| s.trim().trim_matches(|c| c == '\'' || c == '"' || c == '`')).collect();
    if args.len() >= 4 {
        let output = args[0];
        let bottom = args[1];
        let middle = args[2];
        let top = args[3];
        if !output.is_empty() {
            scanned_items.push(output.to_string());
            scanned_items.push(bottom.to_string());
            scanned_items.push(middle.to_string());
            scanned_items.push(top.to_string());
            return Some(Recipe {
                recipe_type: "ae2:inscriber".to_string(),
                inputs: vec![
                    Ingredient { item: bottom.to_string(), count: Some(1) },
                    Ingredient { item: middle.to_string(), count: Some(1) },
                    Ingredient { item: top.to_string(), count: Some(1) },
                ],
                outputs: vec![Ingredient { item: output.to_string(), count: Some(1) }],
                grid: None,
                additional_data: None,
                stage_required: None,
            });
        }
    }
    None
}

fn parse_event_recipes_calls(content: &str, recipes: &mut Vec<Recipe>, scanned_items: &mut Vec<String>) {
    let mut cursor = 0;
    while let Some(idx) = content[cursor..].find("event.recipes.") {
        let start = cursor + idx + 14;
        let token_end = content[start..].find('(').unwrap_or(0) + start;
        let method_token = &content[start..token_end].trim();
        let parts: Vec<&str> = method_token.split('.').collect();
        if parts.len() >= 2 {
            let mod_id = parts[0];
            let mechanic = parts[1];
            let full_type = format!("{}:{}", mod_id, mechanic);

            // Find matching closing paren
            if let Some(close_idx) = content[token_end..].find(')') {
                let call_args = &content[token_end + 1..token_end + close_idx];
                
                // Extract string literals in call_args
                let mut literals = Vec::new();
                let mut in_str = false;
                let mut str_buf = String::new();
                for c in call_args.chars() {
                    if c == '\'' || c == '"' || c == '`' {
                        if in_str {
                            literals.push(str_buf.clone());
                            str_buf.clear();
                            in_str = false;
                        } else {
                            in_str = true;
                        }
                    } else if in_str {
                        str_buf.push(c);
                    }
                }

                if !literals.is_empty() {
                    let output = literals.last().cloned().unwrap_or_default();
                    let mut inputs = Vec::new();
                    for lit in &literals[..literals.len() - 1] {
                        if !lit.is_empty() && lit.contains(':') {
                            inputs.push(Ingredient { item: lit.clone(), count: Some(1) });
                            scanned_items.push(lit.clone());
                        }
                    }
                    if !output.is_empty() {
                        scanned_items.push(output.clone());
                        recipes.push(Recipe {
                            recipe_type: full_type,
                            inputs,
                            outputs: vec![Ingredient { item: output, count: Some(1) }],
                            grid: None,
                            additional_data: None,
                            stage_required: None,
                        });
                    }
                }
                cursor = token_end + close_idx + 1;
                continue;
            }
        }
        cursor = start + 1;
    }
}

fn parse_event_shaped(line: &str, scanned_items: &mut Vec<String>) -> Option<Recipe> {
    let start = line.find("event.shaped(")? + 13;
    let end = line[start..].rfind(')')? + start;
    let inside = &line[start..end];

    // Extract output
    let output_part = inside.split(',').next()?.trim().trim_matches(|c| c == '\'' || c == '"' || c == '`');
    if output_part.is_empty() { return None; }
    scanned_items.push(output_part.to_string());

    // Extract Pattern array: ['ABA', 'BCB', 'ABA']
    let pattern_start = inside.find('[')?;
    let pattern_end = inside[pattern_start..].find(']')? + pattern_start;
    let pattern_str = &inside[pattern_start + 1..pattern_end];
    let rows: Vec<String> = pattern_str.split(',')
        .map(|r| r.trim().trim_matches(|c| c == '\'' || c == '"' || c == '`').to_string())
        .collect();

    // Extract Key map: { A: 'item:a', B: 'item:b' }
    let mut key_map = HashMap::new();
    if let Some(key_start) = inside.find('{') {
        if let Some(key_end) = inside[key_start..].find('}') {
            let key_str = &inside[key_start + 1..key_start + key_end];
            for pair in key_str.split(',') {
                let parts: Vec<&str> = pair.split(':').collect();
                if parts.len() >= 2 {
                    let k = parts[0].trim().trim_matches(|c| c == '\'' || c == '"');
                    let joined_v = parts[1..].join(":");
                    let v = joined_v.trim().trim_matches(|c| c == '\'' || c == '"' || c == '`');
                    if let Some(c) = k.chars().next() {
                        key_map.insert(c, v.to_string());
                        scanned_items.push(v.to_string());
                    }
                }
            }
        }
    }

    // Build 3x3 Grid
    let mut grid = vec!["".to_string(); 9];
    for (r_idx, row) in rows.iter().enumerate().take(3) {
        for (c_idx, ch) in row.chars().enumerate().take(3) {
            let slot = r_idx * 3 + c_idx;
            if let Some(item_id) = key_map.get(&ch) {
                grid[slot] = item_id.clone();
            }
        }
    }

    let mut inputs = Vec::new();
    for (_, v) in &key_map {
        inputs.push(Ingredient {
            item: v.clone(),
            count: Some(1),
        });
    }

    Some(Recipe {
        recipe_type: "minecraft:crafting_shaped".to_string(),
        inputs,
        outputs: vec![Ingredient { item: output_part.to_string(), count: Some(1) }],
        grid: Some(grid),
        additional_data: None,
        stage_required: None,
    })
}

fn parse_event_shapeless(line: &str, scanned_items: &mut Vec<String>) -> Option<Recipe> {
    let start = line.find("event.shapeless(")? + 16;
    let end = line[start..].rfind(')')? + start;
    let inside = &line[start..end];

    let output_part = inside.split(',').next()?.trim().trim_matches(|c| c == '\'' || c == '"' || c == '`');
    if output_part.is_empty() { return None; }
    scanned_items.push(output_part.to_string());

    let mut inputs = Vec::new();
    if let Some(arr_start) = inside.find('[') {
        if let Some(arr_end) = inside[arr_start..].find(']') {
            let arr_str = &inside[arr_start + 1..arr_start + arr_end];
            for item in arr_str.split(',') {
                let cleaned = item.trim().trim_matches(|c| c == '\'' || c == '"' || c == '`');
                if !cleaned.is_empty() {
                    inputs.push(Ingredient { item: cleaned.to_string(), count: Some(1) });
                    scanned_items.push(cleaned.to_string());
                }
            }
        }
    }

    Some(Recipe {
        recipe_type: "minecraft:crafting_shapeless".to_string(),
        inputs,
        outputs: vec![Ingredient { item: output_part.to_string(), count: Some(1) }],
        grid: None,
        additional_data: None,
        stage_required: None,
    })
}

fn parse_event_single_io(line: &str, scanned_items: &mut Vec<String>) -> Option<Recipe> {
    let (rtype, start_token) = if line.contains("event.smelting(") {
        ("minecraft:smelting", "event.smelting(")
    } else if line.contains("event.blasting(") {
        ("minecraft:blasting", "event.blasting(")
    } else {
        ("minecraft:smoking", "event.smoking(")
    };

    let start = line.find(start_token)? + start_token.len();
    let end = line[start..].find(')')? + start;
    let inside = &line[start..end];

    let parts: Vec<&str> = inside.split(',').collect();
    if parts.len() >= 2 {
        let output = parts[0].trim().trim_matches(|c| c == '\'' || c == '"' || c == '`');
        let input = parts[1].trim().trim_matches(|c| c == '\'' || c == '"' || c == '`');

        if !output.is_empty() && !input.is_empty() {
            scanned_items.push(output.to_string());
            scanned_items.push(input.to_string());
            return Some(Recipe {
                recipe_type: rtype.to_string(),
                inputs: vec![Ingredient { item: input.to_string(), count: Some(1) }],
                outputs: vec![Ingredient { item: output.to_string(), count: Some(1) }],
                grid: None,
                additional_data: None,
                stage_required: None,
            });
        }
    }
    None
}

fn fastrand_u64() -> u64 {
    std::time::SystemTime::now().elapsed().unwrap_or_default().as_nanos() as u64
}
