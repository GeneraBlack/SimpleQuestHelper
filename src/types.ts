export interface CustomItem {
  id: string;
  name: string;
  texture_path: string | null;
  stage_required?: string;
  hide_in_jei?: boolean;
  tooltip?: string;
}

export interface CustomBlock {
  id: string;
  name: string;
  texture_path: string | null;
  stage_required?: string;
}

export interface Ingredient {
  item: string;
  count: number | null;
}

export interface Recipe {
  recipe_type: string;
  inputs: Ingredient[];
  outputs: Ingredient[];
  grid?: string[]; // 9 slots for 3x3 shaped crafting grid
  additional_data: any | null;
  stage_required?: string;
}

export interface RecipeRemoval {
  target: string;
  removal_type: "output" | "type" | "id" | "mod";
}

export interface ItemRestriction {
  target: string;
  stage: string;
  is_block: boolean;
}

export interface RewardTableEntry {
  item: string;
  count: number | null;
  weight: number | null;
}

export interface RewardTable {
  id: string;
  title: string;
  icon: string;
  is_loot_crate: boolean;
  rewards: RewardTableEntry[];
}

export interface QuestTask {
  task_type: string;
  item: string | null;
  count: number | null;
}

export interface QuestReward {
  reward_type: string; // "item" | "stage" | "table"
  item: string | null;
  count: number | null;
  stage?: string;
  table_id?: string;
}

export interface QuestNode {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  tasks: QuestTask[];
  rewards: QuestReward[];
  x: number;
  y: number;
}

export interface QuestChapter {
  id: string;
  title: string;
  icon: string;
  quests: QuestNode[];
}

export interface TagGroup {
  tag: string;
  items: string[];
}

export interface LootRule {
  target: string;
  target_type: string; // 'entity' | 'block'
  chance?: number;
  drops: Ingredient[];
}

export interface LintIssue {
  level: "error" | "warning" | "info";
  message: String;
  context?: string;
}

export interface ModpackData {
  items: CustomItem[];
  blocks: CustomBlock[];
  recipes: Recipe[];
  removed_recipes: RecipeRemoval[];
  item_restrictions: ItemRestriction[];
  reward_tables: RewardTable[];
  chapters: QuestChapter[];
  tags: TagGroup[];
  hidden_items: string[];
  disable_vanilla_ores: boolean;
  custom_loot: LootRule[];
  starter_items: Ingredient[];
  stages: string[];
  custom_mechanics: string[];
  target_version?: string;
}

export interface SyncedData {
  items: string[];
  mechanics: string[];
  detected_mods: string[];
  detected_version?: string;
  detected_loader?: string;
}

