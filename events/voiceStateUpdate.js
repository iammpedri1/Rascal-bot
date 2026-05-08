const {
  moveVoiceSession,
  startVoiceSession,
  stopVoiceSession,
} = require("../utils/voiceStats");

module.exports = {
  name: "voiceStateUpdate",

  execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user?.bot) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (!oldChannelId && newChannelId) {
      startVoiceSession(member, newChannelId);
      return;
    }

    if (oldChannelId && !newChannelId) {
      stopVoiceSession(member);
      return;
    }

    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      moveVoiceSession(member, newChannelId);
    }
  },
};
