use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomItem {
    pub id: String,
    pub name: String,
    pub texture_path: Option<String>,
    pub stage_required: Option<String>,
    pub hide_in_jei: Option<bool>,
    pub tooltip: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomBlock {
    pub id: String,
    pub name: String,
    pub texture_path: Option<String>,
    pub stage_required: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ingredient {
    pub item: String,
    pub count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub recipe_type: String,
    pub inputs: Vec<Ingredient>,
    pub outputs: Vec<Ingredient>,
    pub grid: Option<Vec<String>>, // 9 slots for 3x3 shaped crafting grid
    pub additional_data: Option<serde_json::Value>,
    pub stage_required: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeRemoval {
    pub target: String, // e.g. "minecraft:iron_pickaxe" or "minecraft:smelting"
    pub removal_type: String, // "output" | "type" | "id" | "mod"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemRestriction {
    pub target: String, // Item or Block ID
    pub stage: String,
    pub is_block: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardTableEntry {
    pub item: String,
    pub count: Option<u32>,
    pub weight: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardTable {
    pub id: String,
    pub title: String,
    pub icon: String,
    pub is_loot_crate: bool,
    pub rewards: Vec<RewardTableEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestNode {
    pub id: String,
    pub title: String,
    pub description: String,
    pub dependencies: Vec<String>,
    pub tasks: Vec<QuestTask>,
    pub rewards: Vec<QuestReward>,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestTask {
    pub task_type: String,
    pub item: Option<String>,
    pub count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestReward {
    pub reward_type: String, // "item", "stage", "table"
    pub item: Option<String>,
    pub count: Option<u32>,
    pub stage: Option<String>,
    pub table_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestChapter {
    pub id: String,
    pub title: String,
    pub icon: String,
    pub quests: Vec<QuestNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagGroup {
    pub tag: String,
    pub items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LootRule {
    pub target: String,
    pub target_type: String,
    pub chance: Option<f64>,
    pub drops: Vec<Ingredient>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LintIssue {
    pub level: String,
    pub message: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModpackData {
    pub items: Vec<CustomItem>,
    pub blocks: Vec<CustomBlock>,
    pub recipes: Vec<Recipe>,
    pub removed_recipes: Vec<RecipeRemoval>,
    pub item_restrictions: Vec<ItemRestriction>,
    pub reward_tables: Vec<RewardTable>,
    pub chapters: Vec<QuestChapter>,
    pub tags: Vec<TagGroup>,
    pub hidden_items: Vec<String>,
    pub disable_vanilla_ores: bool,
    pub custom_loot: Vec<LootRule>,
    pub starter_items: Vec<Ingredient>,
    pub stages: Vec<String>,
    pub custom_mechanics: Vec<String>,
    pub target_version: Option<String>, // e.g. "1.21.1", "1.26+", "1.20.1"
}
