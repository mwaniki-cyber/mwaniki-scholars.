import { supabase } from "./supabase.js";

const $ = id => document.getElementById(id);

const state = {
  user: null,
  profile: null,
  communities: [],
  community: null,
  channels: [],
  channel: null,
  memberships: [],
  members: [],
  profiles: new Map(),
  presence: new Map(),
  messages: [],
  attachments: new Map(),
  reactions: new Map(),
  admins: new Set(),
  isAdmin: false,
  replyTo: null,
  pendingFiles: [],
  presenceChannel: null,
  messageChannel: null,
  typingChannel: null,
  callChannel: null,
  typingUsers: new Map(),
  selectedCallUsers: new Set(),
  callType: "video",
  incomingCall: null,
  recorder: null,
  recordingStream: null,
  recordingChunks: [],
  createCategory: "general",
  muted: false,
  deafened: false
};

const escapeHTML = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

function nameOf(profile, fallback = "Mwaniki Scholar") {
  if (!profile) return fallback;
  const firstLast = [profile.first_name, profile.last_name]
    .filter(Boolean).join(" ").trim();
  return profile.full_name || profile.display_name ||
    profile.name || firstLast || fallback;
}

function avatarOf(profile) {
  return profile?.photo_url || profile?.avatar_url ||
    profile?.profile_photo_url || profile?.profile_picture ||
    profile?.profile_image || profile?.image_url ||
    profile?.avatar || "";
}

function initials(name) {
  const parts = String(name || "MS").trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

function currentUserName() {
  return nameOf(state.profile,
    state.user?.user_metadata?.full_name ||
    state.user?.user_metadata?.name ||
    state.user?.email?.split("@")[0] ||
    "Mwaniki Scholar");
}

function userProfile(userId) {
  if (userId === state.user?.id) return state.profile;
  return state.profiles.get(userId) || null;
}

function userName(userId) {
  const profile = userProfile(userId);
  return profile
    ? nameOf(profile)
    : userId === state.user?.id
      ? currentUserName()
      : "Community member";
}

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 3200);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "";
}

function setVisible(id, visible) {
  $(id)?.classList.toggle("hidden", !visible);
}

function setAvatar(id, profile) {
  const img = $(id);
  if (!img) return;
  const url = avatarOf(profile);
  if (url) {
    img.src = url;
    img.alt = nameOf(profile);
    img.hidden = false;
    img.onerror = () => {
      img.removeAttribute("src");
      img.alt = initials(nameOf(profile));
      img.classList.add("avatar-failed");
    };
  } else {
    img.removeAttribute("src");
    img.alt = initials(nameOf(profile));
  }
}

function setPresenceDot(id, status) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("online", "away", "offline");
  el.classList.add(status || "offline");
}

function isOnline(userId) {
  const p = state.presence.get(userId);
  if (!p || p.status !== "online") return false;
  const stamp = Date.parse(p.updated_at || p.last_seen_at || "");
  // A stale online record should not remain online forever.
  return Number.isNaN(stamp) || Date.now() - stamp < 120000;
}

function isRulesChannel(channel = state.channel) {
  const text = `${channel?.name || ""} ${channel?.title || ""} ${channel?.channel_type || ""} ${channel?.type || ""}`.toLowerCase();
  return /\brules?\b/.test(text) || channel?.is_rules === true;
}

function channelName(channel) {
  return channel?.name || channel?.title || "discussion";
}

function channelCategory(channel) {
  const explicit = String(channel?.category || channel?.category_name || "").toLowerCase();
  if (["information", "general", "study", "courses", "community", "voice"].includes(explicit)) return explicit;
  if (String(channel?.channel_type || channel?.type || "").toLowerCase() === "voice") return "voice";
  if (/rule|welcome|announcement|information/.test(channelName(channel).toLowerCase())) return "information";
  if (channel?.course_id || /course/.test(explicit)) return "courses";
  if (/study|revision|exam|clinical|lecture/.test(channelName(channel).toLowerCase())) return "study";
  if (/meme|game|social|off-topic/.test(channelName(channel).toLowerCase())) return "community";
  return "general";
}

function canSendHere() {
  return Boolean(state.user && state.channel &&
    (!isRulesChannel() || state.isAdmin));
}

async function loadCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error("You must sign in before opening the community.");
  state.user = data.user;
}

async function loadProfile() {
  const { data, error } = await supabase
    .from("chat_public_profiles")
    .select("*")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) console.warn("Public profile lookup:", error.message);
  state.profile = data || state.user.user_metadata || {};

  setAvatar("headerProfileAvatar", state.profile);
  setAvatar("profileLargeAvatar", state.profile);
  setText("headerProfileName", currentUserName());
  setText("sidebarUserName", currentUserName());
}

async function loadAdmins() {
  state.admins = new Set();
  state.isAdmin = false;

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id");

  if (!error) {
    (data || []).forEach(row => {
      if (row.user_id) state.admins.add(row.user_id);
    });
  } else {
    console.warn("Admin lookup:", error.message);
  }

  // Also allow an administrator role on the user's membership row.
  const ownMembership = state.memberships.find(row => row.user_id === state.user.id);
  const role = String(ownMembership?.role || ownMembership?.member_role || "").toLowerCase();
  state.isAdmin = state.admins.has(state.user.id) ||
    ["admin", "administrator", "moderator", "super admin", "super_admin"].includes(role);
}

async function loadCommunities() {
  const { data, error } = await supabase
    .from("chat_communities")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  state.communities = data || [];

  state.community =
    state.communities.find(c => String(c.name || "").trim().toLowerCase() === "mwaniki scholars") ||
    state.communities[0] || null;

  renderCommunityRail();
  if (state.community) renderCommunityHeader();
}

function renderCommunityHeader() {
  const c = state.community;
  if (!c) return;
  setText("selectedCommunityName", c.name || "Mwaniki Scholars");
  setText("selectedCommunityDescription", c.description || "Medical Community");
  setText("selectedCommunityIcon", c.icon || "🩺");
}

function renderCommunityRail() {
  const list = $("communityRailList");
  if (!list) return;
  list.replaceChildren();

  state.communities.forEach(c => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rail-community-button";
    button.textContent = c.icon || initials(c.name);
    button.title = c.name || "Community";
    button.classList.toggle("active", String(c.id) === String(state.community?.id));
    button.addEventListener("click", () => switchCommunity(c));
    list.appendChild(button);
  });
}

async function switchCommunity(community) {
  if (!community || String(community.id) === String(state.community?.id)) return;

  await removeChannel(state.messageChannel);
  await removeChannel(state.typingChannel);
  state.messageChannel = null;
  state.typingChannel = null;
  state.community = community;
  state.channel = null;
  state.messages = [];
  state.presence.clear();
  state.typingUsers.clear();

  renderCommunityHeader();
  renderCommunityRail();
  await loadChannels();
  await loadMembers();
  await loadPresence();
  subscribePresence();
  await updateMyPresence("online");
}

async function loadChannels() {
  if (!state.community) return;

  const { data, error } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("community_id", state.community.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Channel loading:", error);
    toast("Unable to load channels. Check channel-table permissions.");
    return;
  }

  state.channels = data || [];
  renderChannels();

  if (!state.channels.length) {
    state.channel = null;
    $("messageList").innerHTML = '<div class="message-loading">No channels are available in this community.</div>';
    return;
  }

  const preferred = state.channels.find(c => channelName(c).toLowerCase() === "general") ||
    state.channels.find(c => /welcome|rules/.test(channelName(c).toLowerCase())) ||
    state.channels[0];

  await selectChannel(preferred, false);
}

function renderChannels() {
  const buckets = {
    information: $("informationChannels"),
    general: $("generalChannels"),
    study: $("studyChannels"),
    courses: $("courseChannels"),
    community: $("communityChannels"),
    voice: $("voiceChannels")
  };

  Object.values(buckets).forEach(el => { if (el) el.replaceChildren(); });
  const filter = ($("channelSearchInput")?.value || "").toLowerCase();

  state.channels
    .filter(c => channelName(c).toLowerCase().includes(filter))
    .forEach(channel => {
      const category = channelCategory(channel);
      const list = buckets[category] || buckets.general;
      if (!list) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "channel-item";
      button.classList.toggle("active", String(channel.id) === String(state.channel?.id));
      button.dataset.channelId = channel.id;

      const icon = document.createElement("span");
      icon.className = "channel-icon";
      icon.textContent = category === "voice" ? "🔊" : isRulesChannel(channel) ? "📌" : "#";

      const label = document.createElement("span");
      label.className = "channel-item-name";
      label.textContent = channelName(channel);

      button.append(icon, label);
      button.addEventListener("click", () => selectChannel(channel));
      list.appendChild(button);
    });

  Object.entries(buckets).forEach(([category, list]) => {
    if (list && !list.children.length) {
      const empty = document.createElement("div");
      empty.className = "channel-empty";
      empty.textContent = category === "courses" ? "No course channels" : "No channels";
      list.appendChild(empty);
    }
  });

  setText("courseChannelCount", String(state.channels.filter(c => channelCategory(c) === "courses").length));
}

async function selectChannel(channel, scroll = true) {
  if (!channel) return;

  await removeChannel(state.messageChannel);
  await removeChannel(state.typingChannel);
  state.messageChannel = null;
  state.typingChannel = null;

  state.channel = channel;
  state.messages = [];
  state.attachments.clear();
  state.reactions.clear();
  state.typingUsers.clear();
  cancelReply();

  renderChannels();
  setText("currentChannelName", channelName(channel));
  setText("currentChannelDescription", channel.description || "Academic discussion and collaboration");
  setText("currentChannelIcon", channelCategory(channel) === "voice" ? "🔊" : "#");
  setText("currentChannelType", isRulesChannel(channel) ? "Rules" : channelCategory(channel) === "voice" ? "Voice" : "Text");

  const input = $("messageInput");
  const send = $("sendMessageButton");
  if (input) {
    input.placeholder = isRulesChannel(channel) && !state.isAdmin
      ? "Only administrators can post in Rules"
      : `Message #${channelName(channel)}…`;
    input.disabled = !canSendHere();
  }
  if (send) send.disabled = !canSendHere();

  await loadMessages();
  subscribeMessages();
  subscribeTyping();

  if (scroll) scrollToBottom();
}

async function loadMembers() {
  if (!state.community) return;

  const { data, error } = await supabase
    .from("chat_community_members")
    .select("*")
    .eq("community_id", state.community.id);

  if (error) {
    console.error("Community memberships:", error);
    toast("Unable to load community members.");
    return;
  }

  state.memberships = data || [];
  const ids = [...new Set(state.memberships.map(m => m.user_id).filter(Boolean))];

  // Use the actual public profile table, not student_profiles.
  if (ids.length) {
    const { data: profiles, error: profileError } = await supabase
      .from("chat_public_profiles")
      .select("*")
      .in("id", ids);

    if (profileError) console.warn("Member profiles:", profileError.message);
    state.profiles = new Map((profiles || []).map(p => [p.id, p]));
  }

  if (state.profile && state.user) state.profiles.set(state.user.id, state.profile);
  state.members = state.memberships.map(m => ({
    ...m,
    profile: state.profiles.get(m.user_id) || null
  }));

  await loadAdmins();
  renderMembers();
  renderCallMembers();
}

async function loadPresence() {
  // chat_presence has user_id as its key; it is not keyed by id/community_id.
  const ids = state.members.map(m => m.user_id).filter(Boolean);
  if (!ids.length) {
    state.presence.clear();
    renderMembers();
    return;
  }

  const { data, error } = await supabase
    .from("chat_presence")
    .select("user_id,status,custom_status,last_seen_at,updated_at")
    .in("user_id", ids);

  if (error) {
    console.warn("Presence load:", error.message);
    return;
  }

  state.presence = new Map((data || []).map(p => [p.user_id, p]));
  renderMembers();
}

async function updateMyPresence(status = "online") {
  if (!state.user) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("chat_presence")
    .upsert({
      user_id: state.user.id,
      status,
      last_seen_at: now,
      updated_at: now
    }, { onConflict: "user_id" });

  if (error) console.warn("Presence update:", error.message);

  state.presence.set(state.user.id, {
    user_id: state.user.id,
    status,
    last_seen_at: now,
    updated_at: now
  });

  setText("sidebarUserStatus", status === "online" ? "Online" : status === "away" ? "Away" : "Offline");
  setPresenceDot("headerPresenceDot", status);
  setPresenceDot("sidebarPresenceDot", status);
  renderMembers();
}

function subscribePresence() {
  if (state.presenceChannel) supabase.removeChannel(state.presenceChannel);

  state.presenceChannel = supabase
    .channel("mwaniki-presence-" + state.user.id)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "chat_presence"
    }, payload => {
      const p = payload.new;
      if (!p?.user_id) return;
      state.presence.set(p.user_id, p);
      renderMembers();
      renderCallMembers();
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") console.info("Community presence subscribed.");
    });
}

function renderMembers() {
  const list = $("memberList");
  if (!list) return;
  list.replaceChildren();

  const query = ($("memberSearchInput")?.value || "").toLowerCase();
  const members = state.members.filter(m => {
    const n = nameOf(m.profile, m.user_id === state.user?.id ? currentUserName() : "Community member");
    return n.toLowerCase().includes(query);
  });

  const online = members.filter(m => isOnline(m.user_id));
  const offline = members.filter(m => !isOnline(m.user_id));
  setText("memberCount", String(members.length));
  setText("channelMemberCount", String(members.length));

  for (const [heading, group] of [["ONLINE", online], ["OFFLINE", offline]]) {
    if (!group.length) continue;
    const title = document.createElement("div");
    title.className = "member-group-title";
    title.textContent = `${heading} — ${group.length}`;
    list.appendChild(title);

    group.forEach(m => {
      const profile = m.profile || userProfile(m.user_id);
      const name = nameOf(profile, m.user_id === state.user?.id ? currentUserName() : "Community member");
      const status = isOnline(m.user_id) ? "online" : "offline";
      const row = document.createElement("div");
      row.className = "member-item";
      const img = document.createElement("img");
      img.className = "avatar avatar-small";
      img.alt = name;
      img.src = avatarOf(profile) || "";
      img.onerror = () => { img.removeAttribute("src"); img.alt = initials(name); };
      const dot = document.createElement("span");
      dot.className = `presence-dot ${status}`;
      const wrap = document.createElement("span");
      wrap.className = "avatar-wrap";
      wrap.append(img, dot);
      const copy = document.createElement("span");
      copy.className = "member-item-copy";
      const strong = document.createElement("strong");
      strong.textContent = name;
      const small = document.createElement("span");
      small.textContent = profile?.custom_status || (status === "online" ? "Online" : "Offline");
      copy.append(strong, small);
      row.append(wrap, copy);
      list.appendChild(row);
    });
  }

  renderCallMembers();
}

async function loadMessages() {
  const list = $("messageList");
  if (!state.channel || !list) return;

  list.innerHTML = '<div class="message-loading"><span class="loading-spinner"></span> Loading messages…</div>';

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("channel_id", state.channel.id)
    .order("created_at", { ascending: true })
    .limit(250);

  if (error) {
    console.error("Message load:", error);
    list.innerHTML = '<div class="message-loading">Unable to load messages. Check Supabase permissions.</div>';
    return;
  }

  state.messages = data || [];
  await enrichMessageProfiles();
  await loadAttachmentsForMessages();
  await loadReactionsForMessages();
  renderMessages();
}

async function enrichMessageProfiles() {
  const ids = [...new Set(state.messages.map(m => m.user_id || m.sender_id).filter(Boolean))];
  const missing = ids.filter(id => !state.profiles.has(id));
  if (!missing.length) return;

  const { data, error } = await supabase
    .from("chat_public_profiles")
    .select("*")
    .in("id", missing);

  if (error) console.warn("Message author profiles:", error.message);
  (data || []).forEach(p => state.profiles.set(p.id, p));
}

function messageText(m) {
  return m.content || m.message || m.text || "";
}

function messageUserId(m) {
  return m.user_id || m.sender_id || "";
}

async function loadAttachmentsForMessages() {
  const ids = state.messages.map(m => m.id).filter(Boolean);
  if (!ids.length) return;

  const { data, error } = await supabase
    .from("chat_attachments")
    .select("*")
    .in("message_id", ids);

  if (error) {
    console.warn("Message attachments:", error.message);
    return;
  }

  state.attachments.clear();
  (data || []).forEach(a => {
    const current = state.attachments.get(a.message_id) || [];
    current.push(a);
    state.attachments.set(a.message_id, current);
  });
}

async function loadReactionsForMessages() {
  const ids = state.messages.map(m => m.id).filter(Boolean);
  if (!ids.length) return;

  const { data, error } = await supabase
    .from("chat_message_reactions")
    .select("*")
    .in("message_id", ids);

  if (error) {
    console.warn("Message reactions:", error.message);
    return;
  }

  state.reactions.clear();
  (data || []).forEach(r => {
    const list = state.reactions.get(r.message_id) || [];
    list.push(r);
    state.reactions.set(r.message_id, list);
  });
}

function renderMessages() {
  const list = $("messageList");
  if (!list) return;
  list.replaceChildren();

  const search = ($("messageSearchInput")?.value || $("globalSearchInput")?.value || "").toLowerCase();
  const messages = state.messages.filter(m => !search ||
    messageText(m).toLowerCase().includes(search) ||
    userName(messageUserId(m)).toLowerCase().includes(search));

  if (!messages.length) {
    list.innerHTML = `<div class="message-loading">${search ? "No matching messages." : "No messages yet. Start the discussion."}</div>`;
    return;
  }

  messages.forEach(m => {
    const uid = messageUserId(m);
    const profile = userProfile(uid);
    const name = uid === state.user?.id ? currentUserName() : nameOf(profile);
    const article = document.createElement("article");
    article.className = "message";
    article.dataset.messageId = m.id;

    const img = document.createElement("img");
    img.className = "message-avatar";
    img.alt = name;
    if (avatarOf(profile)) img.src = avatarOf(profile);
    img.onerror = () => { img.removeAttribute("src"); img.alt = initials(name); };

    const body = document.createElement("div");
    body.className = "message-body";

    const meta = document.createElement("div");
    meta.className = "message-meta";
    const author = document.createElement("strong");
    author.className = "message-author";
    author.textContent = name;
    const time = document.createElement("time");
    time.className = "message-time";
    time.textContent = m.created_at ? new Date(m.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
    meta.append(author, time);
    body.appendChild(meta);

    if (m.reply_to) {
      const replied = state.messages.find(x => String(x.id) === String(m.reply_to));
      if (replied) {
        const preview = document.createElement("div");
        preview.className = "message-reply-preview";
        preview.textContent = `Replying to ${userName(messageUserId(replied))}: ${messageText(replied).slice(0, 180)}`;
        body.appendChild(preview);
      }
    }

    if (messageText(m)) {
      const content = document.createElement("div");
      content.className = "message-content";
      content.textContent = messageText(m);
      body.appendChild(content);
    }

    const attachmentList = state.attachments.get(m.id) || [];
    if (attachmentList.length) {
      const container = document.createElement("div");
      container.className = "message-attachments";
      attachmentList.forEach(a => {
        const url = a.file_url || a.url || "";
        const type = a.file_type || a.mime_type || "";
        const fname = a.file_name || a.name || "Attachment";
        if (!url) return;

        if (type.startsWith("image/")) {
          const link = document.createElement("a");
          link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
          const image = document.createElement("img");
          image.className = "message-image";
          image.src = url; image.alt = fname;
          link.appendChild(image); container.appendChild(link);
        } else if (type.startsWith("audio/")) {
          const audio = document.createElement("audio");
          audio.className = "message-audio";
          audio.controls = true; audio.preload = "metadata"; audio.src = url;
          container.appendChild(audio);
        } else {
          const link = document.createElement("a");
          link.className = "message-file";
          link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
          link.textContent = `📎 ${fname}`;
          container.appendChild(link);
        }
      });
      body.appendChild(container);
    }

    const actions = document.createElement("div");
    actions.className = "message-actions";
    const reply = document.createElement("button");
    reply.className = "message-action";
    reply.textContent = "↩ Reply";
    reply.addEventListener("click", () => startReply(m));
    const react = document.createElement("button");
    react.className = "message-action";
    react.textContent = "☺ React";
    react.addEventListener("click", () => addReaction(m.id));
    actions.append(reply, react);

    if (uid === state.user?.id || state.isAdmin) {
      const del = document.createElement("button");
      del.className = "message-action";
      del.textContent = "Delete";
      del.addEventListener("click", () => deleteMessage(m));
      actions.appendChild(del);
    }
    body.appendChild(actions);

    const reactions = state.reactions.get(m.id) || [];
    if (reactions.length) {
      const grouped = new Map();
      reactions.forEach(r => {
        const emoji = r.reaction || r.emoji || "👍";
        grouped.set(emoji, (grouped.get(emoji) || 0) + 1);
      });
      const reactionBar = document.createElement("div");
      reactionBar.className = "message-reactions";
      grouped.forEach((count, emoji) => {
        const b = document.createElement("button");
        b.className = "message-reaction";
        b.textContent = `${emoji} ${count}`;
        b.addEventListener("click", () => addReaction(m.id, emoji));
        reactionBar.appendChild(b);
      });
      body.appendChild(reactionBar);
    }

    article.append(img, body);
    list.appendChild(article);
  });
}

function scrollToBottom() {
  const list = $("messageList");
  if (list) list.scrollTop = list.scrollHeight;
}

function startReply(message) {
  state.replyTo = message;
  setText("replyPreview", `${userName(messageUserId(message))}: ${messageText(message) || "Attachment"}`.slice(0, 240));
  setVisible("replyBar", true);
  $("messageInput")?.focus();
}

function cancelReply() {
  state.replyTo = null;
  setVisible("replyBar", false);
  setText("replyPreview", "");
}

async function removeChannel(channel) {
  if (!channel) return;
  try { await supabase.removeChannel(channel); } catch (e) { console.warn(e); }
}
// CONTINUED — community.js, Part 2 of 2

async function sendMessage() {
  const input = $("messageInput");
  if (!input || !state.user || !state.channel) {
    toast("Select a channel before sending a message.");
    return;
  }
  if (!canSendHere()) {
    toast("Only authorized administrators can post in the Rules channel.");
    return;
  }

  const content = input.value.trim();
  if (!content && !state.pendingFiles.length) return;

  const payload = {
    channel_id: state.channel.id,
    user_id: state.user.id,
    content: content || null
  };
  if (state.replyTo) payload.reply_to = state.replyTo.id;

  let result = await supabase.from("chat_messages").insert(payload).select("*").single();

  // Support older schemas without a reply_to column.
  if (result.error && state.replyTo) {
    const retryPayload = { ...payload };
    delete retryPayload.reply_to;
    result = await supabase.from("chat_messages").insert(retryPayload).select("*").single();
    if (!result.error) toast("Message sent; this database does not yet save reply links.");
  }

  if (result.error) {
    console.error("Send message:", result.error);
    toast("Message was not sent. Check Supabase permissions and the chat_messages schema.");
    return;
  }

  const newMessage = result.data;
  input.value = "";
  input.style.height = "auto";
  setText("messageCharacterCount", "0 / 5000");
  cancelReply();

  const files = [...state.pendingFiles];
  state.pendingFiles = [];
  renderPendingFiles();

  if (files.length) await uploadAttachments(newMessage.id, files);

  if (!state.messages.some(m => String(m.id) === String(newMessage.id))) {
    state.messages.push(newMessage);
    await enrichMessageProfiles();
    await loadAttachmentsForMessages();
    renderMessages();
  }

  scrollToBottom();
  stopTyping();
}

async function uploadAttachments(messageId, files) {
  for (const file of files) {
    try {
      if (file.size > 25 * 1024 * 1024) {
        toast(`${file.name} is larger than the 25 MB limit.`);
        continue;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `community/${state.user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      const url = urlData?.publicUrl;
      if (!url) throw new Error("Could not create the attachment URL.");

      const { error } = await supabase.from("chat_attachments").insert({
        message_id: messageId,
        file_name: file.name,
        file_url: url,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        uploaded_by: state.user.id
      });
      if (error) throw error;
    } catch (error) {
      console.error("Attachment upload:", error);
      toast(`Could not upload ${file.name}. Check the chat-attachments storage bucket and policies.`);
    }
  }

  await loadAttachmentsForMessages();
  renderMessages();
}

function addFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      toast(`${file.name} is larger than 25 MB.`);
      continue;
    }
    if (!state.pendingFiles.some(f => f.name === file.name && f.size === file.size)) {
      state.pendingFiles.push(file);
    }
  }
  renderPendingFiles();
}

function renderPendingFiles() {
  const panel = $("attachmentPreview");
  if (!panel) return;
  panel.replaceChildren();
  panel.classList.toggle("hidden", state.pendingFiles.length === 0);

  state.pendingFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "pending-file";
    const label = document.createElement("span");
    label.textContent = `${file.type.startsWith("image/") ? "🖼" : file.type.startsWith("audio/") ? "🎵" : "📎"} ${file.name}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove attachment";
    remove.addEventListener("click", () => {
      state.pendingFiles.splice(index, 1);
      renderPendingFiles();
    });
    item.append(label, remove);
    panel.appendChild(item);
  });
}

async function addReaction(messageId, selectedEmoji) {
  if (!state.user) return;
  const emoji = selectedEmoji || window.prompt("Enter an emoji to react with:", "👍");
  if (!emoji) return;

  const { error } = await supabase.from("chat_message_reactions").upsert({
    message_id: messageId,
    user_id: state.user.id,
    reaction: emoji
  }, { onConflict: "message_id,user_id,reaction" });

  if (error) {
    console.error("Reaction:", error);
    toast("Could not add reaction. Check the reaction table and its policies.");
    return;
  }
  await loadReactionsForMessages();
  renderMessages();
}

async function deleteMessage(message) {
  const owner = messageUserId(message) === state.user?.id;
  if (!owner && !state.isAdmin) {
    toast("You can only delete your own messages.");
    return;
  }
  if (!window.confirm("Delete this message?")) return;

  let query = supabase.from("chat_messages").delete().eq("id", message.id);
  if (!state.isAdmin) query = query.eq("user_id", state.user.id);

  const { error } = await query;
  if (error) {
    console.error("Delete message:", error);
    toast("Could not delete the message. Check database permissions.");
    return;
  }
  state.messages = state.messages.filter(m => String(m.id) !== String(message.id));
  renderMessages();
}

function subscribeMessages() {
  if (!state.channel) return;

  state.messageChannel = supabase
    .channel(`community-messages-${state.channel.id}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "chat_messages",
      filter: `channel_id=eq.${state.channel.id}`
    }, async payload => {
      if (payload.eventType === "INSERT") {
        if (!state.messages.some(m => String(m.id) === String(payload.new.id))) {
          state.messages.push(payload.new);
          await enrichMessageProfiles();
          await loadAttachmentsForMessages();
          await loadReactionsForMessages();
          renderMessages();
          scrollToBottom();
        }
      } else if (payload.eventType === "DELETE") {
        state.messages = state.messages.filter(m => String(m.id) !== String(payload.old.id));
        renderMessages();
      } else if (payload.eventType === "UPDATE") {
        state.messages = state.messages.map(m => String(m.id) === String(payload.new.id) ? payload.new : m);
        renderMessages();
      }
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") console.info("Community messages subscribed.");
    });
}

function subscribeTyping() {
  if (!state.channel) return;

  state.typingChannel = supabase
    .channel(`community-typing-${state.channel.id}`)
    .on("broadcast", { event: "typing-start" }, ({ payload }) => {
      if (!payload?.user_id || payload.user_id === state.user.id) return;
      state.typingUsers.set(payload.user_id, Date.now() + 2500);
      renderTyping();
    })
    .on("broadcast", { event: "typing-stop" }, ({ payload }) => {
      if (payload?.user_id) state.typingUsers.delete(payload.user_id);
      renderTyping();
    })
    .subscribe();
}

function startTyping() {
  if (!state.typingChannel || !state.user) return;
  state.typingChannel.send({
    type: "broadcast",
    event: "typing-start",
    payload: { user_id: state.user.id }
  });
  clearTimeout(startTyping.timer);
  startTyping.timer = setTimeout(stopTyping, 1500);
}

function stopTyping() {
  clearTimeout(startTyping.timer);
  if (state.typingChannel && state.user) {
    state.typingChannel.send({
      type: "broadcast",
      event: "typing-stop",
      payload: { user_id: state.user.id }
    });
  }
}

function renderTyping() {
  const now = Date.now();
  for (const [id, expires] of state.typingUsers) {
    if (expires < now) state.typingUsers.delete(id);
  }
  const names = [...state.typingUsers.keys()].map(userName);
  setText("typingText", names.length === 1
    ? `${names[0]} is typing…`
    : names.length > 1
      ? `${names.length} people are typing…`
      : "");
  setVisible("typingIndicator", names.length > 0);
  if (names.length) setTimeout(renderTyping, 800);
}

function renderEmojiPicker() {
  const grid = $("emojiGrid");
  if (!grid) return;

  // Use this as a quick-access list; users can paste any Unicode emoji into the composer.
  const emojis = [..."😀 😃 😄 😁 😆 😅 😂 🙂 🙃 😉 😊 😍 🥰 😎 🤔 😭 😴 🤯 🥳 🤝 👍 👎 👏 🙌 🙏 💪 ❤️ 💙 💚 💯 🔥 ✨ 🎉 📚 🩺 🧪 🧬 🧠 🫀 🦠 🧫 💊 🩸 🩻 🧑‍⚕️ 👩‍⚕️ 👨‍⚕️".split(" ")];
  grid.replaceChildren();

  emojis.forEach(emoji => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emoji-choice";
    b.textContent = emoji;
    b.title = emoji;
    b.addEventListener("click", () => insertAtCursor($("messageInput"), emoji));
    grid.appendChild(b);
  });
}

function insertAtCursor(input, text) {
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  input.focus();
  input.selectionStart = input.selectionEnd = start + text.length;
  updateComposer();
}

function renderStickers() {
  const grid = $("stickerGrid");
  if (!grid) return;
  grid.replaceChildren();
  ["🩺", "🧠", "🫀", "🧪", "🧬", "🦠", "📚", "💊", "🩸", "🎓", "👏", "🙏"].forEach(emoji => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sticker-choice";
    b.textContent = emoji;
    b.addEventListener("click", () => insertAtCursor($("messageInput"), emoji));
    grid.appendChild(b);
  });
}

function togglePanel(id) {
  const panel = $(id);
  if (!panel) return;
  const opening = panel.classList.contains("hidden");
  ["emojiPanel", "stickerPanel", "gifPanel"].forEach(p => setVisible(p, false));
  setVisible(id, opening);
  if (opening && id === "emojiPanel") $("emojiSearch")?.focus();
  if (opening && id === "gifPanel") $("gifSearch")?.focus();
}

function updateComposer() {
  const input = $("messageInput");
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  setText("messageCharacterCount", `${input.value.length} / 5000`);
}

async function toggleVoiceRecording() {
  if (state.recorder?.state === "recording") {
    state.recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast("Voice recording is not supported by this browser.");
    return;
  }

  try {
    state.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recordingChunks = [];
    state.recorder = new MediaRecorder(state.recordingStream);

    state.recorder.addEventListener("dataavailable", e => {
      if (e.data?.size) state.recordingChunks.push(e.data);
    });

    state.recorder.addEventListener("stop", () => {
      const blob = new Blob(state.recordingChunks, { type: state.recorder.mimeType || "audio/webm" });
      if (blob.size) {
        state.pendingFiles.push(new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type }));
        renderPendingFiles();
        toast("Voice note ready. Send it with your message.");
      }
      state.recordingStream?.getTracks().forEach(t => t.stop());
      state.recordingStream = null;
      state.recorder = null;
      $("voiceNoteButton").textContent = "🎙";
    });

    state.recorder.start();
    $("voiceNoteButton").textContent = "⏹";
    toast("Recording voice note. Press the microphone again to finish.");
  } catch (error) {
    console.error("Voice note:", error);
    toast("Microphone permission was denied or unavailable.");
  }
}

function renderCallMembers() {
  const list = $("callMemberList");
  if (!list) return;
  const search = ($("callMemberSearch")?.value || "").toLowerCase();
  list.replaceChildren();

  const candidates = state.members.filter(m => {
    const id = m.user_id;
    return id && id !== state.user?.id && isOnline(id) &&
      nameOf(m.profile, "Community member").toLowerCase().includes(search);
  });

  if (!candidates.length) {
    list.innerHTML = '<div class="message-loading">No other online members are available.</div>';
  }

  candidates.forEach(m => {
    const id = m.user_id;
    const name = nameOf(m.profile, "Community member");
    const row = document.createElement("label");
    row.className = "call-member-item";

    const img = document.createElement("img");
    img.className = "avatar avatar-small";
    img.alt = name;
    if (avatarOf(m.profile)) img.src = avatarOf(m.profile);
    img.onerror = () => img.removeAttribute("src");

    const label = document.createElement("span");
    label.textContent = name;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selectedCallUsers.has(id);
    checkbox.addEventListener("change", () => {
      checkbox.checked ? state.selectedCallUsers.add(id) : state.selectedCallUsers.delete(id);
      updateCallCount();
    });
    row.append(img, label, checkbox);
    list.appendChild(row);
  });
  updateCallCount();
}

function updateCallCount() {
  setText("selectedCallMemberCount", `${state.selectedCallUsers.size} selected`);
}

function openCallPicker() {
  state.selectedCallUsers.clear();
  setVisible("callPickerModal", true);
  renderCallMembers();
}

function closeCallPicker() {
  setVisible("callPickerModal", false);
  state.selectedCallUsers.clear();
  updateCallCount();
}

function startCall(ids = [...state.selectedCallUsers], type = state.callType) {
  const targets = [...new Set(ids)].filter(id => id && id !== state.user?.id);
  if (!targets.length) {
    toast("Select at least one online member.");
    return;
  }

  const params = new URLSearchParams();
  params.set("mode", targets.length === 1 ? "direct" : "general");
  params.set("call_type", type);
  params.set("targets", targets.join(","));
  if (state.community?.id) {
    params.set("community_id", state.community.id);
    params.set("community_name", state.community.name || "Mwaniki Scholars");
  }
  if (state.channel?.id) {
    params.set("channel_id", state.channel.id);
    params.set("channel_name", channelName(state.channel));
  }
  closeCallPicker();
  window.location.href = `./community-calls.html?${params.toString()}`;
}

function subscribeIncomingCalls() {
  state.callChannel = supabase
    .channel(`incoming-calls-${state.user.id}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "chat_call_participants",
      filter: `user_id=eq.${state.user.id}`
    }, payload => {
      const p = payload.new;
      if (p?.status === "invited" && p.user_id === state.user.id) handleIncomingCall(p);
    })
    .subscribe();
}

async function handleIncomingCall(participant) {
  if (state.incomingCall) return;
  const { data: room, error } = await supabase
    .from("chat_call_rooms")
    .select("*")
    .eq("id", participant.room_id)
    .maybeSingle();

  if (error || !room || room.status === "ended" || room.room_status === "ended") return;

  let caller = null;
  if (room.created_by) {
    const { data } = await supabase.from("chat_public_profiles")
      .select("*").eq("id", room.created_by).maybeSingle();
    caller = data;
  }

  state.incomingCall = { participant, room, caller };
  setText("incomingCallName", nameOf(caller));
  setText("incomingCallType", `${room.call_type || "video"} call`);
  const avatar = $("incomingCallAvatar");
  if (avatar) {
    avatar.textContent = initials(nameOf(caller));
    if (avatarOf(caller)) {
      avatar.style.backgroundImage = `url("${avatarOf(caller).replace(/"/g, "%22")}")`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.textContent = "";
    } else {
      avatar.style.backgroundImage = "";
    }
  }
  setVisible("incomingCallModal", true);
}

async function acceptIncomingCall() {
  const incoming = state.incomingCall;
  if (!incoming) return;

  const now = new Date().toISOString();
  const { error } = await supabase.from("chat_call_participants")
    .update({ status: "joined", joined_at: now, left_at: null, updated_at: now })
    .eq("id", incoming.participant.id)
    .eq("user_id", state.user.id);

  if (error) {
    console.error("Accept call:", error);
    toast("Unable to accept the call.");
    return;
  }

  const room = incoming.room;
  const params = new URLSearchParams({
    mode: room.call_scope === "community" ? "community" : room.call_scope === "direct" ? "direct" : "general",
    call_type: room.call_type || "video",
    room_id: room.id
  });
  if (room.community_id) params.set("community_id", room.community_id);
  state.incomingCall = null;
  setVisible("incomingCallModal", false);
  window.location.href = `./community-calls.html?${params.toString()}`;
}

async function declineIncomingCall() {
  const incoming = state.incomingCall;
  if (!incoming) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from("chat_call_participants")
    .update({ status: "declined", left_at: now, updated_at: now })
    .eq("id", incoming.participant.id)
    .eq("user_id", state.user.id);
  if (error) console.warn("Decline call:", error.message);
  state.incomingCall = null;
  setVisible("incomingCallModal", false);
}

async function createChannel(event) {
  event.preventDefault();
  if (!state.isAdmin) {
    toast("Only administrators can create channels.");
    return;
  }

  const name = $("newChannelName")?.value.trim();
  if (!name || !state.community) return;

  const type = $("newChannelType")?.value || "text";
  const payload = {
    community_id: state.community.id,
    name: name.toLowerCase().replace(/\s+/g, "-"),
    description: $("newChannelDescription")?.value.trim() || "",
    channel_type: type,
    is_private: Boolean($("newChannelPrivate")?.checked),
    created_by: state.user.id
  };

  const { error } = await supabase.from("chat_channels").insert(payload);
  if (error) {
    console.error("Create channel:", error);
    toast("Could not create channel. Verify your chat_channels columns and RLS policies.");
    return;
  }

  $("createChannelForm")?.reset();
  setVisible("createChannelModal", false);
  await loadChannels();
  toast("Channel created.");
}

function openCreateChannel(category = "general") {
  if (!state.isAdmin) {
    toast("Only administrators can create channels.");
    return;
  }
  state.createCategory = category;
  setVisible("createChannelModal", true);
  $("newChannelName")?.focus();
}

function togglePanelFromButton(id) {
  setVisible(id, $(id)?.classList.contains("hidden"));
}

function goHome() {
  window.location.href = "./dashboard.html";
}

function bindEvents() {
  $("communityHomeButton")?.addEventListener("click", goHome);
  $("railHomeButton")?.addEventListener("click", goHome);

  $("mobileSidebarButton")?.addEventListener("click", () => {
    $("channelSidebar")?.classList.toggle("mobile-open");
  });

  $("channelMembersButton")?.addEventListener("click", () => {
    $("memberSidebar")?.classList.toggle("mobile-open");
  });
  $("closeMemberSidebarButton")?.addEventListener("click", () => $("memberSidebar")?.classList.remove("mobile-open"));

  $("channelSearchInput")?.addEventListener("input", renderChannels);
  $("memberSearchInput")?.addEventListener("input", renderMembers);
  $("callMemberSearch")?.addEventListener("input", renderCallMembers);

  $("messageInput")?.addEventListener("input", () => {
    updateComposer();
    startTyping();
  });
  $("messageInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  $("sendMessageButton")?.addEventListener("click", sendMessage);
  $("cancelReplyButton")?.addEventListener("click", cancelReply);

  $("attachButton")?.addEventListener("click", () => $("attachmentInput")?.click());
  $("attachmentInput")?.addEventListener("change", event => {
    addFiles(event.target.files);
    event.target.value = "";
  });
  $("voiceNoteButton")?.addEventListener("click", toggleVoiceRecording);

  $("emojiButton")?.addEventListener("click", () => togglePanel("emojiPanel"));
  $("stickerButton")?.addEventListener("click", () => togglePanel("stickerPanel"));
  $("gifButton")?.addEventListener("click", () => togglePanel("gifPanel"));
  $("closeEmojiButton")?.addEventListener("click", () => setVisible("emojiPanel", false));
  $("closeStickerButton")?.addEventListener("click", () => setVisible("stickerPanel", false));
  $("closeGifButton")?.addEventListener("click", () => setVisible("gifPanel", false));

  $("emojiSearch")?.addEventListener("input", event => {
    const query = event.target.value.trim();
    if (query && [...query].some(ch => ch.codePointAt(0) > 127)) {
      // Pasting an emoji in the search field inserts that exact Unicode sequence.
      if (/\p{Extended_Pictographic}/u.test(query)) insertAtCursor($("messageInput"), query);
    }
  });

  $("gifSearch")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const value = event.target.value.trim();
      if (/^https?:\/\//i.test(value)) {
        insertAtCursor($("messageInput"), value);
        setVisible("gifPanel", false);
      } else {
        toast("Paste a direct GIF URL here, or search for a GIF on a provider and paste its link.");
      }
    }
  });

  $("channelSearchButton")?.addEventListener("click", () => {
    setVisible("messageSearchBar", true);
    $("messageSearchInput")?.focus();
  });
  $("closeMessageSearchButton")?.addEventListener("click", () => {
    setVisible("messageSearchBar", false);
    $("messageSearchInput").value = "";
    renderMessages();
  });
  $("messageSearchInput")?.addEventListener("input", renderMessages);
  $("globalSearchInput")?.addEventListener("input", renderMessages);

  $("friendsButton")?.addEventListener("click", () => {
    const content = $("friendsContent");
    if (content) {
      content.replaceChildren();
      state.members.forEach(m => {
        const row = document.createElement("p");
        row.textContent = `${nameOf(m.profile)} — ${isOnline(m.user_id) ? "Online" : "Offline"}`;
        content.appendChild(row);
      });
    }
    setVisible("friendsModal", true);
  });
  $("closeFriendsButton")?.addEventListener("click", () => setVisible("friendsModal", false));

  $("profileButton")?.addEventListener("click", () => {
    const content = $("profileModalContent");
    if (content) {
      content.replaceChildren();
      const heading = document.createElement("h3");
      heading.textContent = currentUserName();
      const email = document.createElement("p");
      email.textContent = state.user?.email || "";
      const status = document.createElement("p");
      status.textContent = `Presence: ${state.presence.get(state.user?.id)?.status || "online"}`;
      content.append(heading, email, status);
    }
    setVisible("profileModal", true);
  });
  $("closeProfileButton")?.addEventListener("click", () => setVisible("profileModal", false));
  $("sidebarSettingsButton")?.addEventListener("click", () => $("profileButton")?.click());

  $("communityMenuButton")?.addEventListener("click", () => {
    if (state.isAdmin) openCreateChannel();
    else toast("Community settings are available to administrators.");
  });

  $("addCommunityButton")?.addEventListener("click", () => {
    toast("Community creation needs a configured community-creation workflow and database policy.");
  });

  document.querySelectorAll("[data-category-add]").forEach(button => {
    button.addEventListener("click", () => openCreateChannel(button.dataset.categoryAdd));
  });
  document.querySelectorAll(".category-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const section = button.closest(".channel-category");
      const list = section?.querySelector(".channel-list");
      if (list) list.classList.toggle("hidden");
    });
  });

  $("createChannelForm")?.addEventListener("submit", createChannel);
  $("closeCreateChannelButton")?.addEventListener("click", () => setVisible("createChannelModal", false));
  $("cancelCreateChannelButton")?.addEventListener("click", () => setVisible("createChannelModal", false));

  $("generalCallButton")?.addEventListener("click", openCallPicker);
  $("communityCallButton")?.addEventListener("click", openCallPicker);
  $("closeCallPickerButton")?.addEventListener("click", closeCallPicker);
  $("callSelectAllButton")?.addEventListener("click", () => {
    const candidates = state.members.filter(m => m.user_id !== state.user?.id && isOnline(m.user_id));
    const allSelected = candidates.every(m => state.selectedCallUsers.has(m.user_id));
    candidates.forEach(m => allSelected
      ? state.selectedCallUsers.delete(m.user_id)
      : state.selectedCallUsers.add(m.user_id));
    renderCallMembers();
  });
  document.querySelectorAll("[data-call-type]").forEach(button => {
    button.addEventListener("click", () => {
      state.callType = button.dataset.callType === "audio" ? "audio" : "video";
      document.querySelectorAll("[data-call-type]").forEach(b => b.classList.toggle("active", b === button));
    });
  });
  $("startSelectedCallButton")?.addEventListener("click", () => startCall());
  $("acceptIncomingCallButton")?.addEventListener("click", acceptIncomingCall);
  $("declineIncomingCallButton")?.addEventListener("click", declineIncomingCall);

  $("notificationButton")?.addEventListener("click", () => togglePanelFromButton("notificationPanel"));
  $("closeNotificationPanelButton")?.addEventListener("click", () => setVisible("notificationPanel", false));

  $("sidebarMuteButton")?.addEventListener("click", () => {
    state.muted = !state.muted;
    $("sidebarMuteButton").textContent = state.muted ? "🔇" : "🎙";
    toast("Microphone preference changed. It takes effect inside the call window.");
  });
  $("sidebarHeadsetButton")?.addEventListener("click", () => {
    state.deafened = !state.deafened;
    $("sidebarHeadsetButton").textContent = state.deafened ? "🔈" : "🎧";
    toast("Audio preference changed. It takes effect inside the call window.");
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("globalSearchInput")?.focus();
    }
    if (event.key === "Escape") {
      ["emojiPanel", "stickerPanel", "gifPanel", "callPickerModal", "incomingCallModal",
        "friendsModal", "profileModal", "rulesModal", "createChannelModal", "notificationPanel"]
        .forEach(id => setVisible(id, false));
    }
  });

  window.addEventListener("online", () => updateMyPresence("online"));
  window.addEventListener("offline", () => updateMyPresence("offline"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateMyPresence("online");
    else updateMyPresence("away");
  });
}

async function initializeCommunity() {
  try {
    bindEvents();
    await loadCurrentUser();
    await loadProfile();
    await loadCommunities();

    if (!state.community) {
      toast("No communities were returned from Supabase.");
      return;
    }

    await loadChannels();
    await loadMembers();
    await loadPresence();
    subscribePresence();
    subscribeIncomingCalls();
    await updateMyPresence("online");

    setText("sidebarUserStatus", "Online");
    renderEmojiPicker();
    renderStickers();
    renderPendingFiles();
    updateComposer();
    document.body.classList.add("community-ready");
    console.info("Mwaniki Scholars Community initialized.");
  } catch (error) {
    console.error("Community initialization:", error);
    toast(error?.message || "Could not initialize the community. Check authentication and Supabase access.");
  }
}

window.addEventListener("beforeunload", () => {
  if (state.recorder?.state === "recording") state.recorder.stop();
  state.recordingStream?.getTracks().forEach(track => track.stop());
  // Do not mark offline on every navigation: another tab may still be active.
});

initializeCommunity();
