const {
  moveVoiceSession,
  startVoiceSession,
  stopVoiceSession,
  updateVoiceEligibility,
  updateVoiceStreaming,
} = require("../utils/voiceStats");
const { isPrimaryGuild } = require("../utils/primaryGuild");

module.exports = {
  name: "voiceStateUpdate",

  execute(oldState, newState) {
    if (!isPrimaryGuild(newState.guild?.id || oldState.guild?.id)) return;
    const member = newState.member || oldState.member;
    if (!member || member.user?.bot) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (!oldChannelId && newChannelId) {
      startVoiceSession(member, newChannelId);
    } else if (oldChannelId && !newChannelId) {
      stopVoiceSession(member);
      return;
    } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      moveVoiceSession(member, newChannelId);
    }

    if (newChannelId) {
      updateVoiceEligibility(member);
      updateVoiceStreaming(member, newState.streaming);
    }
  },
};
