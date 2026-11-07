#![deny(clippy::unwrap_used)]

use napi_derive::napi;

#[napi]
pub fn normalize_content(content: String) -> String {
    rascal_core::normalize_content(&content)
}

#[napi(object)]
pub struct WorkRoll {
    pub event: String,
    pub profession_index: u32,
    pub base_reward: i32,
    pub loss: i32,
    pub bonus: i32,
    pub critical: bool,
}

#[napi]
pub fn resolve_work_roll(
    roll: f64,
    profession_roll: f64,
    reward_roll: f64,
    bonus_roll: f64,
    loss_roll: f64,
    tool_loss_roll: f64,
) -> WorkRoll {
    let result = rascal_core::resolve_work_roll(
        roll,
        profession_roll,
        reward_roll,
        bonus_roll,
        loss_roll,
        tool_loss_roll,
    );

    WorkRoll {
        event: result.event.to_owned(),
        profession_index: result.profession_index as u32,
        base_reward: result.base_reward,
        loss: result.loss,
        bonus: result.bonus,
        critical: result.critical,
    }
}
