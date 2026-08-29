use std::collections::{HashMap, HashSet};
use crate::models::{ModpackData, LintIssue};

#[tauri::command]
pub fn lint_modpack_logic(data: ModpackData) -> Vec<LintIssue> {
    let mut issues = Vec::new();

    // 1. Gather all produced item IDs
    let mut known_items = HashSet::new();
    let mut item_stage_map = HashMap::new();

    for item in &data.items {
        known_items.insert(format!("kubejs:{}", item.id));
        if let Some(stage) = &item.stage_required {
            item_stage_map.insert(format!("kubejs:{}", item.id), stage.clone());
        }
    }

    for block in &data.blocks {
        known_items.insert(format!("kubejs:{}", block.id));
    }

    for starter in &data.starter_items {
        known_items.insert(starter.item.clone());
    }

    for loot in &data.custom_loot {
        for drop in &loot.drops {
            known_items.insert(drop.item.clone());
        }
    }

    for recipe in &data.recipes {
        if recipe.inputs.is_empty() {
            issues.push(LintIssue {
                level: "warning".to_string(),
                message: format!("Recipe of type '{}' has no inputs (ingredients).", recipe.recipe_type),
                context: Some(recipe.recipe_type.clone()),
            });
        }
        if recipe.outputs.is_empty() {
            issues.push(LintIssue {
                level: "warning".to_string(),
                message: format!("Recipe of type '{}' has no outputs (results).", recipe.recipe_type),
                context: Some(recipe.recipe_type.clone()),
            });
        }
        for output in &recipe.outputs {
            known_items.insert(output.item.clone());
            if let Some(stage) = &recipe.stage_required {
                item_stage_map.insert(output.item.clone(), stage.clone());
            }
        }
    }

    // 2. Check Custom Items missing textures
    for item in &data.items {
        if item.texture_path.is_none() {
            issues.push(LintIssue {
                level: "info".to_string(),
                message: format!("Custom Item '{}' ({}) does not have a .png texture assigned yet.", item.name, item.id),
                context: Some(item.id.clone()),
            });
        }
    }

    // 3. Check Quests for cycle dependencies & stage deadlocks
    for chapter in &data.chapters {
        let mut adj = HashMap::new();
        let mut quest_map = HashMap::new();

        for quest in &chapter.quests {
            quest_map.insert(quest.id.clone(), quest);
            adj.insert(quest.id.clone(), quest.dependencies.clone());

            // Check if quest has tasks
            if quest.tasks.is_empty() {
                issues.push(LintIssue {
                    level: "info".to_string(),
                    message: format!("Quest '{}' in chapter '{}' has no tasks (conditions).", quest.title, chapter.title),
                    context: Some(quest.title.clone()),
                });
            }

            // Check if quest task requires items locked by this quest's own stage reward
            let unlocked_stages: Vec<String> = quest.rewards.iter()
                .filter(|r| r.reward_type == "stage")
                .filter_map(|r| r.stage.clone())
                .collect();

            for task in &quest.tasks {
                if task.task_type == "item" {
                    if let Some(item_id) = &task.item {
                        if !item_id.is_empty() {
                            if let Some(required_stage) = item_stage_map.get(item_id) {
                                if unlocked_stages.contains(required_stage) {
                                    issues.push(LintIssue {
                                        level: "error".to_string(),
                                        message: format!(
                                            "Deadlock detected: Quest '{}' requires '{}', which can only be crafted after unlocking its own reward stage '{}'!",
                                            quest.title, item_id, required_stage
                                        ),
                                        context: Some(quest.title.clone()),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Cycle detection in Chapter quests (DFS)
        let mut visited = HashMap::new();
        let mut rec_stack = HashMap::new();

        for quest_id in adj.keys() {
            if has_cycle(quest_id, &adj, &mut visited, &mut rec_stack) {
                let q_title = quest_map.get(quest_id).map(|q| q.title.as_str()).unwrap_or(quest_id);
                issues.push(LintIssue {
                    level: "error".to_string(),
                    message: format!("Circular dependency (infinite loop) detected in chapter '{}' around quest '{}'!", chapter.title, q_title),
                    context: Some(chapter.title.clone()),
                });
                break;
            }
        }
    }

    issues
}

fn has_cycle(
    node: &str,
    adj: &HashMap<String, Vec<String>>,
    visited: &mut HashMap<String, bool>,
    rec_stack: &mut HashMap<String, bool>,
) -> bool {
    if *rec_stack.get(node).unwrap_or(&false) {
        return true;
    }
    if *visited.get(node).unwrap_or(&false) {
        return false;
    }

    visited.insert(node.to_string(), true);
    rec_stack.insert(node.to_string(), true);

    if let Some(neighbors) = adj.get(node) {
        for neighbor in neighbors {
            if has_cycle(neighbor, adj, visited, rec_stack) {
                return true;
            }
        }
    }

    rec_stack.insert(node.to_string(), false);
    false
}
