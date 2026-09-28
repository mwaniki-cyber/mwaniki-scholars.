/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY — PHASE 2 ENGINE
   Discord-style academic community
============================================================ */

"use strict";

console.log("🚀 Mwaniki Community Phase 2 engine loaded.");

/* ============================================================
   SUPABASE
============================================================ */

const communitySupabase =
  window.supabaseClient ||
  window.supabase ||
  null;

if (!communitySupabase) {
  console.error("❌ Supabase client was not found.");
}


/* ============================================================
   STATE
============================================================ */

const CommunityState = {

  user: null,

  student: null,

  communities: [],

  channels: [],

  members: [],

  messages: [],

  notifications: [],

  presence: [],

  activeCommunityId: null,

  activeChannelId: null,

  activeMessageId: null,

  replyingTo: null,

  searchTerm: "",

  selectedAttachments: [],

  realtimeChannels: [],

  initialized: false

};


/* ============================================================
   DOM HELPER
============================================================ */

function $(id) {
  return document.getElementById(id);
}


/* ============================================================
   SAFE TEXT
============================================================ */

function escapeHtml(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* ============================================================
   INITIALS
============================================================ */

function getInitials(name) {

  const value =
    String(name || "Student")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!value.length) {
    return "S";
  }

  if (value.length === 1) {
    return value[0].substring(0, 2).toUpperCase();
  }

  return (
    value[0][0] +
    value[value.length - 1][0]
  ).toUpperCase();
}


/* ============================================================
   DATE
============================================================ */

function formatMessageTime(dateValue) {

  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


/* ============================================================
   TOAST
============================================================ */

let toastTimer = null;

function showToast(message, type = "success") {

  const toast = $("communityToast");

  if (!toast) {
    return;
  }

  toast.textContent = message;

  toast.className =
    `community-toast ${type}`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3200);
}


/* ============================================================
   AUTH
============================================================ */

async function getCurrentUser() {

  if (!communitySupabase) {
    return null;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase.auth.getUser();

    if (error) {
      console.error(
        "❌ Community auth error:",
        error
      );

      return null;
    }

    CommunityState.user =
      data?.user || null;

    return CommunityState.user;

  } catch (error) {

    console.error(
      "❌ Unable to retrieve user:",
      error
    );

    return null;
  }
}


/* ============================================================
   STUDENT PROFILE
============================================================ */

async function loadStudentProfile() {

  if (!CommunityState.user) {
    return;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("students")
      .select("*")
      .eq("id", CommunityState.user.id)
      .maybeSingle();

    if (error) {
      console.warn(
        "⚠️ Student profile could not be loaded:",
        error.message
      );

      return;
    }

    CommunityState.student = data || null;

    renderCurrentUser();

  } catch (error) {

    console.error(
      "❌ Profile error:",
      error
    );
  }
}


/* ============================================================
   CURRENT USER
============================================================ */

function renderCurrentUser() {

  const user =
    CommunityState.user;

  const student =
    CommunityState.student;

  const name =
    student?.full_name ||
    student?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Student";

  const photo =
    student?.photo_url ||
    user?.user_metadata?.avatar_url ||
    "";

  if ($("sidebarUserName")) {
    $("sidebarUserName").textContent =
      name;
  }

  if ($("sidebarUserInitial")) {
    $("sidebarUserInitial").textContent =
      getInitials(name);
  }

  if ($("sidebarUserAvatar")) {

    if (photo) {

      $("sidebarUserAvatar").src =
        photo;

      $("sidebarUserAvatar").style.display =
        "block";

      if ($("sidebarUserInitial")) {
        $("sidebarUserInitial").style.display =
          "none";
      }

    } else {

      $("sidebarUserAvatar").removeAttribute("src");

      $("sidebarUserAvatar").style.display =
        "none";

      if ($("sidebarUserInitial")) {
        $("sidebarUserInitial").style.display =
          "flex";
      }
    }
  }
}


/* ============================================================
   LOAD COMMUNITIES
============================================================ */

async function loadCommunities() {

  const list =
    $("communityList");

  if (list) {
    list.innerHTML =
      `<div class="sidebar-loading">Loading communities...</div>`;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_communities")
      .select("*")
      .order("created_at", {
        ascending: true
      });

    if (error) {
      throw error;
    }

    CommunityState.communities =
      data || [];

    renderCommunities();

    if (!CommunityState.activeCommunityId &&
        CommunityState.communities.length) {

      await selectCommunity(
        CommunityState.communities[0].id
      );

    } else if (
      CommunityState.activeCommunityId
    ) {

      await selectCommunity(
        CommunityState.activeCommunityId,
        false
      );
    }

  } catch (error) {

    console.error(
      "❌ Communities failed:",
      error
    );

    if (list) {
      list.innerHTML =
        `<div class="sidebar-loading">Unable to load communities.</div>`;
    }

    showToast(
      "Unable to load communities.",
      "error"
    );
  }
}


/* ============================================================
   RENDER COMMUNITIES
============================================================ */

function renderCommunities() {

  const list =
    $("communityList");

  if (!list) {
    return;
  }

  if (!CommunityState.communities.length) {

    list.innerHTML =
      `<div class="sidebar-loading">No communities available.</div>`;

    return;
  }

  list.innerHTML =
    CommunityState.communities
      .map(community => {

        const active =
          String(community.id) ===
          String(CommunityState.activeCommunityId);

        return `
          <button
            class="community-item ${active ? "active" : ""}"
            type="button"
            data-community-id="${escapeHtml(community.id)}"
          >

            <span class="community-item-icon">
              ${escapeHtml(
                getInitials(
                  community.name ||
                  community.title ||
                  "MC"
                )
              )}
            </span>

            <span class="community-item-content">

              <span class="community-item-name">
                ${escapeHtml(
                  community.name ||
                  community.title ||
                  "Community"
                )}
              </span>

              <span class="community-item-description">
                ${escapeHtml(
                  community.description ||
                  "Mwaniki Scholars Community"
                )}
              </span>

            </span>

          </button>
        `;
      })
      .join("");

  list
    .querySelectorAll("[data-community-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          selectCommunity(
            button.dataset.communityId
          );

        }
      );

    });
}


/* ============================================================
   SELECT COMMUNITY
============================================================ */

async function selectCommunity(
  communityId,
  reload = true
) {

  CommunityState.activeCommunityId =
    communityId;

  renderCommunities();

  await loadChannels(
    communityId
  );

  if (reload) {
    closeMobileSidebar();
  }
}


/* ============================================================
   LOAD CHANNELS
============================================================ */

async function loadChannels(
  communityId
) {

  const list =
    $("channelList");

  if (list) {
    list.innerHTML =
      `<div class="sidebar-loading">Loading channels...</div>`;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_channels")
      .select("*")
      .eq("community_id", communityId)
      .order("created_at", {
        ascending: true
      });

    if (error) {
      throw error;
    }

    CommunityState.channels =
      data || [];

    renderChannels();

    if (!CommunityState.activeChannelId ||
        !CommunityState.channels.some(
          channel =>
            String(channel.id) ===
            String(CommunityState.activeChannelId)
        )) {

      if (CommunityState.channels.length) {

        await selectChannel(
          CommunityState.channels[0].id
        );

      } else {

        clearChannel();
      }

    } else {

      await selectChannel(
        CommunityState.activeChannelId,
        false
      );
    }

  } catch (error) {

    console.error(
      "❌ Channels failed:",
      error
    );

    if (list) {
      list.innerHTML =
        `<div class="sidebar-loading">Unable to load channels.</div>`;
    }

    showToast(
      "Unable to load channels.",
      "error"
    );
  }
}


/* ============================================================
   RENDER CHANNELS
============================================================ */

function renderChannels() {

  const list =
    $("channelList");

  if (!list) {
    return;
  }

  if (!CommunityState.channels.length) {

    list.innerHTML =
      `<div class="sidebar-loading">No channels yet.</div>`;

    return;
  }

  const categories = {};

  CommunityState.channels.forEach(channel => {

    const category =
      channel.category ||
      "Channels";

    if (!categories[category]) {
      categories[category] = [];
    }

    categories[category].push(channel);
  });

  list.innerHTML =
    Object.entries(categories)
      .map(([category, channels]) => {

        return `
          <div class="channel-category">
            ${escapeHtml(category)}
          </div>

          ${channels
            .map(channel => {

              const active =
                String(channel.id) ===
                String(CommunityState.activeChannelId);

              const channelName =
                channel.name ||
                channel.title ||
                "channel";

              return `
                <button
                  class="channel-item ${active ? "active" : ""}"
                  type="button"
                  data-channel-id="${escapeHtml(channel.id)}"
                >

                  <span class="channel-symbol">
                    ${channel.is_private ? "🔒" : "#"}
                  </span>

                  <span class="channel-name">
                    ${escapeHtml(channelName)}
                  </span>

                </button>
              `;

            })
            .join("")}
        `;

      })
      .join("");

  list
    .querySelectorAll("[data-channel-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          selectChannel(
            button.dataset.channelId
          );

        }
      );

    });
}


/* ============================================================
   SELECT CHANNEL
============================================================ */

async function selectChannel(
  channelId,
  reload = true
) {

  CommunityState.activeChannelId =
    channelId;

  const channel =
    CommunityState.channels.find(
      item =>
        String(item.id) ===
        String(channelId)
    );

  renderChannels();

  if (!channel) {
    return;
  }

  const channelName =
    channel.name ||
    channel.title ||
    "channel";

  if ($("activeChannelName")) {
    $("activeChannelName").textContent =
      channelName;
  }

  if ($("welcomeChannelName")) {
    $("welcomeChannelName").textContent =
      `Welcome to #${channelName}`;
  }

  if ($("activeChannelDescription")) {
    $("activeChannelDescription").textContent =
      channel.description ||
      "Join the discussion and learn together.";
  }

  if ($("welcomeChannelDescription")) {
    $("welcomeChannelDescription").textContent =
      channel.description ||
      "Join the discussion and learn together.";
  }

  if ($("channelPrivateBadge")) {

    $("channelPrivateBadge")
      .classList.toggle(
        "hidden",
        !channel.is_private
      );
  }

  if ($("messageInput")) {

    $("messageInput").placeholder =
      `Message #${channelName}`;
  }

  CommunityState.messages = [];

  await loadMessages(channelId);

  await loadMembers();

  await loadReadStatus();

  subscribeToChannel(channelId);

  if (reload) {
    closeMobileSidebar();
  }
}


/* ============================================================
   CLEAR CHANNEL
============================================================ */

function clearChannel() {

  CommunityState.activeChannelId =
    null;

  if ($("activeChannelName")) {
    $("activeChannelName").textContent =
      "Select a channel";
  }

  if ($("activeChannelDescription")) {
    $("activeChannelDescription").textContent =
      "Welcome to Mwaniki Community.";
  }

  if ($("messageList")) {
    $("messageList").innerHTML = "";
  }

  if ($("channelWelcome")) {
    $("channelWelcome").classList.remove("hidden");
  }
}


/* ============================================================
   LOAD MESSAGES
============================================================ */

async function loadMessages(
  channelId
) {

  const messageList =
    $("messageList");

  if (!messageList) {
    return;
  }

  messageList.innerHTML =
    `<div class="empty-state">Loading messages...</div>`;

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", {
        ascending: true
      });

    if (error) {
      throw error;
    }

    CommunityState.messages =
      data || [];

    await enrichMessageUsers();

    renderMessages();

  } catch (error) {

    console.error(
      "❌ Messages failed:",
      error
    );

    messageList.innerHTML =
      `<div class="empty-state">Unable to load messages.</div>`;
  }
}


/* ============================================================
   ENRICH MESSAGE USERS
============================================================ */

async function enrichMessageUsers() {

  const userIds =
    [
      ...new Set(
        CommunityState.messages
          .map(message =>
            message.user_id ||
            message.sender_id ||
            message.author_id
          )
          .filter(Boolean)
      )
    ];

  if (!userIds.length) {
    return;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("students")
      .select("id,full_name,name,photo_url")
      .in("id", userIds);

    if (error) {
      console.warn(
        "⚠️ Message student profiles unavailable:",
        error.message
      );

      return;
    }

    const profiles =
      new Map(
        (data || [])
          .map(student => [
            String(student.id),
            student
          ])
      );

    CommunityState.messages =
      CommunityState.messages.map(
        message => {

          const id =
            message.user_id ||
            message.sender_id ||
            message.author_id;

          return {
            ...message,
            _student:
              profiles.get(String(id)) ||
              null
          };
        }
      );

  } catch (error) {

    console.warn(
      "⚠️ Message enrichment failed:",
      error
    );
  }
}


/* ============================================================
   RENDER MESSAGES
============================================================ */

function renderMessages() {

  const list =
    $("messageList");

  if (!list) {
    return;
  }

  const messages =
    CommunityState.searchTerm
      ? CommunityState.messages.filter(
          message =>
            String(
              message.content ||
              message.message ||
              ""
            )
              .toLowerCase()
              .includes(
                CommunityState.searchTerm
                  .toLowerCase()
              )
        )
      : CommunityState.messages;

  if (!messages.length) {

    list.innerHTML =
      `
        <div class="empty-state">
          ${
            CommunityState.searchTerm
              ? "No messages match your search."
              : "No messages yet. Start the conversation."
          }
        </div>
      `;

    return;
  }

  if ($("channelWelcome")) {
    $("channelWelcome").classList.add("hidden");
  }

  let lastDate = "";

  const html = [];

  messages.forEach(message => {

    const date =
      new Date(
        message.created_at
      );

    const dateLabel =
      Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString([], {
            weekday: "long",
            month: "short",
            day: "numeric"
          });

    if (
      dateLabel &&
      dateLabel !== lastDate
    ) {

      html.push(`
        <div class="date-divider">
          ${escapeHtml(dateLabel)}
        </div>
      `);

      lastDate = dateLabel;
    }

    html.push(
      renderMessage(message)
    );
  });

  list.innerHTML =
    html.join("");

  attachMessageEvents();

  requestAnimationFrame(() => {

    list.scrollTop =
      list.scrollHeight;

  });
}


/* ============================================================
   RENDER MESSAGE
============================================================ */

function renderMessage(message) {

  const student =
    message._student;

  const author =
    student?.full_name ||
    student?.name ||
    message.author_name ||
    message.username ||
    "Student";

  const photo =
    student?.photo_url ||
    message.author_photo ||
    "";

  const userId =
    message.user_id ||
    message.sender_id ||
    message.author_id ||
    "";

  const content =
    message.content ||
    message.message ||
    "";

  const messageId =
    message.id;

  const isOwn =
    CommunityState.user &&
    String(userId) ===
    String(CommunityState.user.id);

  const formattedContent =
    formatMessageContent(content);

  const reactions =
    message.reactions ||
    [];

  return `
    <article
      class="message"
      data-message-id="${escapeHtml(messageId)}"
    >

      <div class="message-avatar">

        ${
          photo
            ? `<img
                 src="${escapeHtml(photo)}"
                 alt="${escapeHtml(author)}"
               />`
            : escapeHtml(
                getInitials(author)
              )
        }

      </div>

      <div class="message-content">

        <div class="message-meta">

          <span class="message-author">
            ${escapeHtml(author)}
          </span>

          ${
            isOwn
              ? `<span class="message-role">You</span>`
              : ""
          }

          <span class="message-time">
            ${escapeHtml(
              formatMessageTime(
                message.created_at
              )
            )}
          </span>

        </div>

        ${
          message.reply_to_id
            ? `
              <div class="reply-reference">
                ↳ Reply
              </div>
            `
            : ""
        }

        <div class="message-body">
          ${formattedContent}
        </div>

        ${
          reactions.length
            ? `
              <div class="message-reactions">
                ${renderReactions(reactions)}
              </div>
            `
            : ""
        }

      </div>

      <div class="message-actions">

        <button
          class="message-action"
          type="button"
          data-message-action="reply"
          data-message-id="${escapeHtml(messageId)}"
          title="Reply"
        >
          ↩
        </button>

        <button
          class="message-action"
          type="button"
          data-message-action="react"
          data-message-id="${escapeHtml(messageId)}"
          title="React"
        >
          ☺
        </button>

        <button
          class="message-action"
          type="button"
          data-message-action="copy"
          data-message-id="${escapeHtml(messageId)}"
          title="Copy"
        >
          ⧉
        </button>

        ${
          isOwn
            ? `
              <button
                class="message-action danger"
                type="button"
                data-message-action="delete"
                data-message-id="${escapeHtml(messageId)}"
                title="Delete"
              >
                🗑
              </button>
            `
            : ""
        }

      </div>

    </article>
  `;
}


/* ============================================================
   FORMAT MESSAGE
============================================================ */

function formatMessageContent(content) {

  let value =
    escapeHtml(content);

  value =
    value.replace(
      /@([A-Za-z0-9_.-]+)/g,
      '<strong>@$1</strong>'
    );

  value =
    value.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

  value =
    value.replace(
      /\n/g,
      "<br>"
    );

  return value;
}


/* ============================================================
   REACTIONS
============================================================ */

function renderReactions(reactions) {

  if (!Array.isArray(reactions)) {
    return "";
  }

  const grouped = {};

  reactions.forEach(reaction => {

    const emoji =
      reaction.emoji ||
      reaction.reaction ||
      "👍";

    if (!grouped[emoji]) {
      grouped[emoji] = {
        count: 0,
        mine: false
      };
    }

    grouped[emoji].count++;

    const reactor =
      reaction.user_id ||
      reaction.student_id;

    if (
      CommunityState.user &&
      String(reactor) ===
      String(CommunityState.user.id)
    ) {
      grouped[emoji].mine = true;
    }

  });

  return Object.entries(grouped)
    .map(([emoji, item]) => {

      return `
        <button
          class="reaction ${item.mine ? "active" : ""}"
          type="button"
          data-reaction="${escapeHtml(emoji)}"
        >
          ${escapeHtml(emoji)}
          <span>${item.count}</span>
        </button>
      `;

    })
    .join("");
}


/* ============================================================
   ATTACH MESSAGE EVENTS
============================================================ */

function attachMessageEvents() {

  document
    .querySelectorAll("[data-message-action]")
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          const action =
            event.currentTarget.dataset.messageAction;

          const messageId =
            event.currentTarget.dataset.messageId;

          handleMessageAction(
            action,
            messageId
          );

        }
      );

    });

  document
    .querySelectorAll("[data-reaction]")
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          const messageElement =
            event.currentTarget.closest(
              ".message"
            );

          if (!messageElement) {
            return;
          }

          toggleReaction(
            messageElement.dataset.messageId,
            event.currentTarget.dataset.reaction
          );

        }
      );

    });

}


/* ============================================================
   MESSAGE ACTIONS
============================================================ */

async function handleMessageAction(
  action,
  messageId
) {

  const message =
    CommunityState.messages.find(
      item =>
        String(item.id) ===
        String(messageId)
    );

  if (!message) {
    return;
  }

  switch (action) {

    case "reply":

      startReply(message);

      break;

    case "react":

      await toggleReaction(
        messageId,
        "👍"
      );

      break;

    case "copy":

      await copyMessage(
        message.content ||
        message.message ||
        ""
      );

      break;

    case "delete":

      await deleteMessage(
        messageId
      );

      break;

    default:
      break;
  }
}


/* ============================================================
   REPLY
============================================================ */

function startReply(message) {

  CommunityState.replyingTo =
    message;

  const author =
    message._student?.full_name ||
    message._student?.name ||
    message.author_name ||
    "Student";

  const content =
    message.content ||
    message.message ||
    "";

  if ($("replyAuthor")) {
    $("replyAuthor").textContent =
      `Replying to ${author}`;
  }

  if ($("replyMessage")) {
    $("replyMessage").textContent =
      content;
  }

  if ($("replyPreview")) {
    $("replyPreview")
      .classList.remove("hidden");
  }

  if ($("messageInput")) {
    $("messageInput").focus();
  }
}


/* ============================================================
   CANCEL REPLY
============================================================ */

function cancelReply() {

  CommunityState.replyingTo =
    null;

  if ($("replyPreview")) {
    $("replyPreview")
      .classList.add("hidden");
  }
}


/* ============================================================
   COPY
============================================================ */

async function copyMessage(content) {

  try {

    await navigator.clipboard.writeText(
      content
    );

    showToast(
      "Message copied.",
      "success"
    );

  } catch (error) {

    showToast(
      "Could not copy message.",
      "error"
    );
  }
}


/* ============================================================
   DELETE MESSAGE
============================================================ */

async function deleteMessage(
  messageId
) {

  if (!CommunityState.user) {
    return;
  }

  const message =
    CommunityState.messages.find(
      item =>
        String(item.id) ===
        String(messageId)
    );

  if (!message) {
    return;
  }

  const owner =
    message.user_id ||
    message.sender_id ||
    message.author_id;

  if (
    String(owner) !==
    String(CommunityState.user.id)
  ) {

    showToast(
      "You can only delete your own messages.",
      "error"
    );

    return;
  }

  const confirmed =
    window.confirm(
      "Delete this message?"
    );

  if (!confirmed) {
    return;
  }

  try {

    const {
      error
    } = await communitySupabase
      .from("chat_messages")
      .delete()
      .eq("id", messageId)
      .eq(
        "user_id",
        CommunityState.user.id
      );

    if (error) {
      throw error;
    }

    CommunityState.messages =
      CommunityState.messages.filter(
        item =>
          String(item.id) !==
          String(messageId)
      );

    renderMessages();

    showToast(
      "Message deleted.",
      "success"
    );

  } catch (error) {

    console.error(
      "❌ Delete message failed:",
      error
    );

    showToast(
      "Message could not be deleted.",
      "error"
    );
  }
}


/* ============================================================
   SEND MESSAGE
============================================================ */

async function sendMessage() {

  if (!CommunityState.user) {

    showToast(
      "Please sign in first.",
      "error"
    );

    return;
  }

  if (!CommunityState.activeChannelId) {

    showToast(
      "Select a channel first.",
      "error"
    );

    return;
  }

  const input =
    $("messageInput");

  if (!input) {
    return;
  }

  const content =
    input.value.trim();

  if (!content) {
    return;
  }

  const button =
    $("sendMessageBtn");

  if (button) {
    button.disabled = true;
  }

  try {

    const payload = {
      channel_id:
        CommunityState.activeChannelId,

      user_id:
        CommunityState.user.id,

      content
    };

    if (CommunityState.replyingTo) {

      payload.reply_to_id =
        CommunityState.replyingTo.id;
    }

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_messages")
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    input.value = "";

    autoResizeTextarea();

    cancelReply();

    if (data) {

      CommunityState.messages.push(
        data
      );

      await enrichSingleMessage(
        data
      );

      renderMessages();
    }

  } catch (error) {

    console.error(
      "❌ Send message failed:",
      error
    );

    showToast(
      "Message could not be sent. Check your community permissions.",
      "error"
    );

  } finally {

    if (button) {
      button.disabled = false;
    }

    input.focus();
  }
}


/* ============================================================
   ENRICH SINGLE MESSAGE
============================================================ */

async function enrichSingleMessage(
  message
) {

  const id =
    message.user_id ||
    message.sender_id ||
    message.author_id;

  if (!id) {
    return;
  }

  try {

    const {
      data
    } = await communitySupabase
      .from("students")
      .select("id,full_name,name,photo_url")
      .eq("id", id)
      .maybeSingle();

    message._student =
      data || null;

  } catch (error) {
    console.warn(
      "⚠️ Could not enrich new message."
    );
  }
}


/* ============================================================
   REACTION
============================================================ */

async function toggleReaction(
  messageId,
  emoji
) {

  if (!CommunityState.user) {
    return;
  }

  try {

    const {
      data: existing,
      error: lookupError
    } = await communitySupabase
      .from("chat_message_reactions")
      .select("*")
      .eq("message_id", messageId)
      .eq(
        "user_id",
        CommunityState.user.id
      )
      .eq("emoji", emoji)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (existing) {

      const {
        error
      } = await communitySupabase
        .from("chat_message_reactions")
        .delete()
        .eq("id", existing.id);

      if (error) {
        throw error;
      }

    } else {

      const {
        error
      } = await communitySupabase
        .from("chat_message_reactions")
        .insert({
          message_id:
            messageId,

          user_id:
            CommunityState.user.id,

          emoji
        });

      if (error) {
        throw error;
      }
    }

    await loadMessages(
      CommunityState.activeChannelId
    );

  } catch (error) {

    console.error(
      "❌ Reaction failed:",
      error
    );

    showToast(
      "Reaction could not be updated.",
      "error"
    );
  }
}


/* ============================================================
   LOAD REACTIONS
============================================================ */

async function loadMessageReactions() {

  if (!CommunityState.messages.length) {
    return;
  }

  const ids =
    CommunityState.messages
      .map(message => message.id)
      .filter(Boolean);

  if (!ids.length) {
    return;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_message_reactions")
      .select("*")
      .in("message_id", ids);

    if (error) {
      throw error;
    }

    const grouped =
      new Map();

    (data || []).forEach(reaction => {

      const id =
        String(reaction.message_id);

      if (!grouped.has(id)) {
        grouped.set(id, []);
      }

      grouped
        .get(id)
        .push(reaction);
    });

    CommunityState.messages =
      CommunityState.messages.map(
        message => ({
          ...message,
          reactions:
            grouped.get(
              String(message.id)
            ) || []
        })
      );

  } catch (error) {

    console.warn(
      "⚠️ Reaction loading failed:",
      error
    );
  }
}


/* ============================================================
   MEMBERS
============================================================ */

async function loadMembers() {

  const communityId =
    CommunityState.activeCommunityId;

  if (!communityId) {
    return;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_community_members")
      .select("*")
      .eq("community_id", communityId);

    if (error) {
      throw error;
    }

    CommunityState.members =
      data || [];

    await enrichMembers();

    renderMembers();

  } catch (error) {

    console.error(
      "❌ Members failed:",
      error
    );

    renderMembers();
  }
}


/* ============================================================
   ENRICH MEMBERS
============================================================ */

async function enrichMembers() {

  const ids =
    CommunityState.members
      .map(member =>
        member.user_id ||
        member.student_id
      )
      .filter(Boolean);

  if (!ids.length) {
    return;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("students")
      .select("id,full_name,name,photo_url")
      .in("id", ids);

    if (error) {
      return;
    }

    const profiles =
      new Map(
        (data || [])
          .map(student => [
            String(student.id),
            student
          ])
      );

    CommunityState.members =
      CommunityState.members.map(
        member => {

          const id =
            member.user_id ||
            member.student_id;

          return {
            ...member,
            _student:
              profiles.get(
                String(id)
              ) || null
          };
        }
      );

  } catch (error) {

    console.warn(
      "⚠️ Member enrichment failed."
    );
  }
}


/* ============================================================
   PRESENCE
============================================================ */

function memberIsOnline(member) {

  const id =
    member.user_id ||
    member.student_id;

  return CommunityState.presence.some(
    presence =>
      String(
        presence.user_id ||
        presence.student_id
      ) ===
      String(id)
  );
}


/* ============================================================
   RENDER MEMBERS
============================================================ */

function renderMembers() {

  const onlineList =
    $("onlineMemberList");

  const offlineList =
    $("offlineMemberList");

  if (!onlineList || !offlineList) {
    return;
  }

  const search =
    ($("memberSearchInput")?.value || "")
      .trim()
      .toLowerCase();

  let members =
    [...CommunityState.members];

  if (search) {

    members =
      members.filter(member => {

        const name =
          member._student?.full_name ||
          member._student?.name ||
          member.username ||
          "";

        return String(name)
          .toLowerCase()
          .includes(search);
      });
  }

  const online =
    members.filter(
      member =>
        memberIsOnline(member)
    );

  const offline =
    members.filter(
      member =>
        !memberIsOnline(member)
    );

  if ($("memberCount")) {
    $("memberCount").textContent =
      `${members.length} member${members.length === 1 ? "" : "s"}`;
  }

  if ($("onlineMemberCount")) {
    $("onlineMemberCount").textContent =
      online.length;
  }

  if ($("offlineMemberCount")) {
    $("offlineMemberCount").textContent =
      offline.length;
  }

  onlineList.innerHTML =
    online.length
      ? online.map(
          member =>
            renderMember(
              member,
              true
            )
        ).join("")
      : `<div class="empty-state">No members online.</div>`;

  offlineList.innerHTML =
    offline.length
      ? offline.map(
          member =>
            renderMember(
              member,
              false
            )
        ).join("")
      : `<div class="empty-state">No other members.</div>`;
}


/* ============================================================
   RENDER MEMBER
============================================================ */

function renderMember(
  member,
  online
) {

  const student =
    member._student;

  const name =
    student?.full_name ||
    student?.name ||
    member.username ||
    "Student";

  const photo =
    student?.photo_url ||
    "";

  const role =
    member.role ||
    "Student";

  return `
    <div class="member-item">

      <div class="member-avatar">

        ${
          photo
            ? `<img
                 src="${escapeHtml(photo)}"
                 alt="${escapeHtml(name)}"
               />`
            : escapeHtml(
                getInitials(name)
              )
        }

        <span
          class="presence-dot ${online ? "online" : ""}"
        ></span>

      </div>

      <div class="member-info">

        <span class="member-name">
          ${escapeHtml(name)}
        </span>

        <span class="member-role">
          ${escapeHtml(role)}
        </span>

      </div>

    </div>
  `;
}


/* ============================================================
   LOAD PRESENCE
============================================================ */

async function loadPresence() {

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_presence")
      .select("*");

    if (error) {
      throw error;
    }

    CommunityState.presence =
      data || [];

    renderMembers();

  } catch (error) {

    console.warn(
      "⚠️ Presence loading failed:",
      error.message
    );
  }
}


/* ============================================================
   UPDATE OWN PRESENCE
============================================================ */

async function updateOwnPresence() {

  if (!CommunityState.user) {
    return;
  }

  try {

    const payload = {
      user_id:
        CommunityState.user.id,

      last_seen:
        new Date().toISOString(),

      online:
        true
    };

    const {
      error
    } = await communitySupabase
      .from("chat_presence")
      .upsert(
        payload,
        {
          onConflict: "user_id"
        }
      );

    if (error) {
      console.warn(
        "⚠️ Presence update:",
        error.message
      );
    }

  } catch (error) {

    console.warn(
      "⚠️ Presence error:",
      error
    );
  }
}


/* ============================================================
   READ STATUS
============================================================ */

async function loadReadStatus() {

  if (
    !CommunityState.user ||
    !CommunityState.activeChannelId
  ) {
    return;
  }

  try {

    const {
      data
    } = await communitySupabase
      .from("chat_read_status")
      .select("*")
      .eq(
        "channel_id",
        CommunityState.activeChannelId
      )
      .eq(
        "user_id",
        CommunityState.user.id
      )
      .maybeSingle();

    if (!data) {
      return;
    }

  } catch (error) {

    console.warn(
      "⚠️ Read status unavailable."
    );
  }
}


/* ============================================================
   MARK CHANNEL READ
============================================================ */

async function markChannelRead() {

  if (
    !CommunityState.user ||
    !CommunityState.activeChannelId
  ) {
    return;
  }

  try {

    const payload = {
      channel_id:
        CommunityState.activeChannelId,

      user_id:
        CommunityState.user.id,

      last_read_at:
        new Date().toISOString()
    };

    const {
      error
    } = await communitySupabase
      .from("chat_read_status")
      .upsert(
        payload,
        {
          onConflict:
            "channel_id,user_id"
        }
      );

    if (error) {
      console.warn(
        "⚠️ Mark read failed:",
        error.message
      );
    }

  } catch (error) {

    console.warn(
      "⚠️ Mark read error."
    );
  }
}


/* ============================================================
   REALTIME
============================================================ */

function removeRealtimeSubscriptions() {

  if (!communitySupabase) {
    return;
  }

  CommunityState.realtimeChannels
    .forEach(channel => {

      try {
        communitySupabase
          .removeChannel(channel);
      } catch (_) {}

    });

  CommunityState.realtimeChannels =
    [];
}


/* ============================================================
   SUBSCRIBE CHANNEL
============================================================ */

function subscribeToChannel(
  channelId
) {

  removeRealtimeSubscriptions();

  if (!communitySupabase) {
    return;
  }

  const channel =
    communitySupabase
      .channel(
        `mwaniki-community-${channelId}`
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter:
            `channel_id=eq.${channelId}`
        },
        async payload => {

          await handleRealtimeMessage(
            payload.new
          );

        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter:
            `channel_id=eq.${channelId}`
        },
        payload => {

          CommunityState.messages =
            CommunityState.messages.filter(
              message =>
                String(message.id) !==
                String(payload.old.id)
            );

          renderMessages();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_message_reactions"
        },
        async () => {

          await loadMessages(
            CommunityState.activeChannelId
          );

          await loadMessageReactions();

          renderMessages();
        }
      )
      .subscribe();

  CommunityState.realtimeChannels.push(
    channel
  );
}


/* ============================================================
   REALTIME MESSAGE
============================================================ */

async function handleRealtimeMessage(
  message
) {

  if (
    CommunityState.messages.some(
      item =>
        String(item.id) ===
        String(message.id)
    )
  ) {
    return;
  }

  await enrichSingleMessage(
    message
  );

  CommunityState.messages.push(
    message
  );

  CommunityState.messages.sort(
    (a, b) =>
      new Date(a.created_at) -
      new Date(b.created_at)
  );

  renderMessages();

  const sender =
    message.user_id ||
    message.sender_id ||
    message.author_id;

  if (
    CommunityState.user &&
    String(sender) !==
    String(CommunityState.user.id)
  ) {

    if (
      document.hidden ||
      CommunityState.activeChannelId
    ) {

      showToast(
        "New community message.",
        "success"
      );
    }
  }

  markChannelRead();
}


/* ============================================================
   NOTIFICATIONS
============================================================ */

async function loadNotifications() {

  if (!CommunityState.user) {
    return;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_notifications")
      .select("*")
      .eq(
        "user_id",
        CommunityState.user.id
      )
      .order("created_at", {
        ascending: false
      })
      .limit(50);

    if (error) {
      throw error;
    }

    CommunityState.notifications =
      data || [];

    renderNotifications();

  } catch (error) {

    console.warn(
      "⚠️ Notifications unavailable:",
      error.message
    );

    CommunityState.notifications =
      [];

    renderNotifications();
  }
}


/* ============================================================
   RENDER NOTIFICATIONS
============================================================ */

function renderNotifications() {

  const list =
    $("notificationList");

  if (!list) {
    return;
  }

  const unread =
    CommunityState.notifications
      .filter(
        notification =>
          !notification.read &&
          !notification.is_read
      )
      .length;

  updateNotificationBadge(
    unread
  );

  if (!CommunityState.notifications.length) {

    list.innerHTML =
      `
        <div class="empty-state">
          You have no community notifications.
        </div>
      `;

    return;
  }

  list.innerHTML =
    CommunityState.notifications
      .map(notification => {

        const isRead =
          notification.read ||
          notification.is_read;

        return `
          <article
            class="notification-item ${!isRead ? "unread" : ""}"
            data-notification-id="${escapeHtml(notification.id)}"
          >

            <div class="notification-title">
              ${escapeHtml(
                notification.title ||
                notification.type ||
                "Community notification"
              )}
            </div>

            <div class="notification-text">
              ${escapeHtml(
                notification.message ||
                notification.content ||
                "You have a new community notification."
              )}
            </div>

            <div class="notification-time">
              ${escapeHtml(
                formatMessageTime(
                  notification.created_at
                )
              )}
            </div>

          </article>
        `;

      })
      .join("");
}


/* ============================================================
   BADGE
============================================================ */

function updateNotificationBadge(
  count
) {

  const badge =
    $("communityNotificationBadge");

  if (!badge) {
    return;
  }

  if (!count) {

    badge.classList.add(
      "hidden"
    );

    badge.textContent =
      "0";

    return;
  }

  badge.classList.remove(
    "hidden"
  );

  badge.textContent =
    count > 99
      ? "99+"
      : String(count);
}


/* ============================================================
   MARK NOTIFICATIONS READ
============================================================ */

async function markNotificationsRead() {

  if (!CommunityState.user) {
    return;
  }

  const unread =
    CommunityState.notifications
      .filter(
        notification =>
          !notification.read &&
          !notification.is_read
      );

  if (!unread.length) {
    return;
  }

  try {

    const ids =
      unread
        .map(
          notification =>
            notification.id
        )
        .filter(Boolean);

    if (!ids.length) {
      return;
    }

    const {
      error
    } = await communitySupabase
      .from("chat_notifications")
      .update({
        read: true,
        is_read: true
      })
      .in(
        "id",
        ids
      );

    if (error) {
      console.warn(
        "⚠️ Could not mark notifications read:",
        error.message
      );

      return;
    }

    CommunityState.notifications =
      CommunityState.notifications.map(
        notification =>
          ids.includes(notification.id)
            ? {
                ...notification,
                read: true,
                is_read: true
              }
            : notification
      );

    renderNotifications();

  } catch (error) {

    console.warn(
      "⚠️ Notification read update failed."
    );
  }
}


/* ============================================================
   SEARCH
============================================================ */

function openSearchModal() {

  const modal =
    $("searchModal");

  if (!modal) {
    return;
  }

  modal.classList.remove(
    "hidden"
  );

  setTimeout(() => {

    $("globalSearchInput")?.focus();

  }, 50);
}


/* ============================================================
   SEARCH DATABASE
============================================================ */

async function searchMessages(
  term
) {

  const results =
    $("searchResults");

  if (!results) {
    return;
  }

  term =
    term.trim();

  if (!term) {

    results.innerHTML =
      "Enter a search term to begin.";

    return;
  }

  results.innerHTML =
    `<div class="empty-state">Searching...</div>`;

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_messages")
      .select("*")
      .ilike(
        "content",
        `%${term}%`
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(50);

    if (error) {
      throw error;
    }

    if (!data?.length) {

      results.innerHTML =
        `
          <div class="empty-state">
            No messages found.
          </div>
        `;

      return;
    }

    results.innerHTML =
      data.map(message => {

        const channel =
          CommunityState.channels.find(
            item =>
              String(item.id) ===
              String(message.channel_id)
          );

        return `
          <article
            class="search-result"
            data-search-message-id="${escapeHtml(message.id)}"
            data-search-channel-id="${escapeHtml(message.channel_id)}"
          >

            <div class="search-result-channel">
              #${escapeHtml(
                channel?.name ||
                channel?.title ||
                "channel"
              )}
            </div>

            <div class="search-result-author">
              Student
            </div>

            <div class="search-result-text">
              ${escapeHtml(
                message.content ||
                ""
              )}
            </div>

          </article>
        `;

      }).join("");

    document
      .querySelectorAll(
        "[data-search-message-id]"
      )
      .forEach(item => {

        item.addEventListener(
          "click",
          async () => {

            const channelId =
              item.dataset.searchChannelId;

            const messageId =
              item.dataset.searchMessageId;

            await selectChannel(
              channelId
            );

            closeModal(
              "searchModal"
            );

            setTimeout(() => {

              highlightMessage(
                messageId
              );

            }, 250);

          }
        );

      });

  } catch (error) {

    console.error(
      "❌ Search failed:",
      error
    );

    results.innerHTML =
      `
        <div class="empty-state">
          Search could not be completed.
        </div>
      `;
  }
}


/* ============================================================
   HIGHLIGHT MESSAGE
============================================================ */

function highlightMessage(
  messageId
) {

  const element =
    document.querySelector(
      `[data-message-id="${CSS.escape(String(messageId))}"]`
    );

  if (!element) {
    return;
  }

  element.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  element.classList.add(
    "highlighted"
  );

  setTimeout(() => {

    element.classList.remove(
      "highlighted"
    );

  }, 2500);
}


/* ============================================================
   CREATE CHANNEL
============================================================ */

async function createChannel(
  event
) {

  event.preventDefault();

  if (!CommunityState.user) {
    return;
  }

  if (!CommunityState.activeCommunityId) {

    showToast(
      "Select a community first.",
      "error"
    );

    return;
  }

  const name =
    $("channelNameInput")
      ?.value
      .trim();

  const description =
    $("channelDescriptionInput")
      ?.value
      .trim();

  const isPrivate =
    Boolean(
      $("channelPrivateInput")
        ?.checked
    );

  if (!name) {
    return;
  }

  try {

    const {
      data,
      error
    } = await communitySupabase
      .from("chat_channels")
      .insert({
        community_id:
          CommunityState.activeCommunityId,

        name,

        description:
          description || null,

        is_private:
          isPrivate,

        created_by:
          CommunityState.user.id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (data) {

      CommunityState.channels.push(
        data
      );

      renderChannels();

      await selectChannel(
        data.id
      );
    }

    closeModal(
      "channelModal"
    );

    $("channelForm")?.reset();

    showToast(
      "Channel created.",
      "success"
    );

  } catch (error) {

    console.error(
      "❌ Channel creation failed:",
      error
    );

    showToast(
      "Channel could not be created. Your account may not have permission.",
      "error"
    );
  }
}


/* ============================================================
   MODALS
============================================================ */

function openModal(
  id
) {

  $(id)?.classList.remove(
    "hidden"
  );
}


function closeModal(
  id
) {

  $(id)?.classList.add(
    "hidden"
  );
}


function closeAllModals() {

  document
    .querySelectorAll(".modal")
    .forEach(modal => {

      modal.classList.add(
        "hidden"
      );

    });

  $("messageContextMenu")
    ?.classList.add(
      "hidden"
    );
}


/* ============================================================
   SIDEBAR MOBILE
============================================================ */

function openMobileSidebar() {

  $("communitySidebar")
    ?.classList.add("open");

  $("mobileOverlay")
    ?.classList.add("open");
}


function closeMobileSidebar() {

  $("communitySidebar")
    ?.classList.remove("open");

  $("mobileOverlay")
    ?.classList.remove("open");
}


/* ============================================================
   MEMBER PANEL
============================================================ */

function toggleMemberPanel() {

  $("memberPanel")
    ?.classList.toggle("open");
}


function closeMemberPanel() {

  $("memberPanel")
    ?.classList.remove("open");
}


/* ============================================================
   TEXTAREA
============================================================ */

function autoResizeTextarea() {

  const textarea =
    $("messageInput");

  if (!textarea) {
    return;
  }

  textarea.style.height =
    "auto";

  textarea.style.height =
    `${Math.min(
      textarea.scrollHeight,
      150
    )}px`;
}


/* ============================================================
   ATTACHMENT UI
============================================================ */

function handleAttachments(
  event
) {

  const files =
    [...(
      event.target.files ||
      []
    )];

  CommunityState.selectedAttachments =
    files;

  const preview =
    $("attachmentPreview");

  if (!preview) {
    return;
  }

  if (!files.length) {

    preview.classList.add(
      "hidden"
    );

    preview.innerHTML =
      "";

    return;
  }

  preview.classList.remove(
    "hidden"
  );

  preview.innerHTML =
    files.map(file => `
      <span class="attachment-chip">
        📎 ${escapeHtml(file.name)}
      </span>
    `).join("");
}


/* ============================================================
   KEYBOARD
============================================================ */

function handleMessageKeydown(
  event
) {

  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {

    event.preventDefault();

    sendMessage();
  }
}


/* ============================================================
   GLOBAL SEARCH SHORTCUT
============================================================ */

function handleGlobalKeyboard(
  event
) {

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k"
  ) {

    event.preventDefault();

    openSearchModal();
  }

  if (
    event.key === "Escape"
  ) {

    closeAllModals();
  }
}


/* ============================================================
   EVENT LISTENERS
============================================================ */

function setupEventListeners() {

  $("messageForm")
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        sendMessage();

      }
    );

  $("messageInput")
    ?.addEventListener(
      "keydown",
      handleMessageKeydown
    );

  $("messageInput")
    ?.addEventListener(
      "input",
      autoResizeTextarea
    );

  $("attachmentBtn")
    ?.addEventListener(
      "click",
      () => {

        $("attachmentInput")
          ?.click();

      }
    );

  $("attachmentInput")
    ?.addEventListener(
      "change",
      handleAttachments
    );

  $("cancelReplyBtn")
    ?.addEventListener(
      "click",
      cancelReply
    );

  $("openSidebarBtn")
    ?.addEventListener(
      "click",
      openMobileSidebar
    );

  $("closeSidebarBtn")
    ?.addEventListener(
      "click",
      closeMobileSidebar
    );

  $("mobileOverlay")
    ?.addEventListener(
      "click",
      closeMobileSidebar
    );

  $("membersToggleBtn")
    ?.addEventListener(
      "click",
      toggleMemberPanel
    );

  $("closeMembersBtn")
    ?.addEventListener(
      "click",
      closeMemberPanel
    );

  $("notificationBtn")
    ?.addEventListener(
      "click",
      async () => {

        openModal(
          "notificationModal"
        );

        await loadNotifications();

        await markNotificationsRead();

      }
    );

  $("searchMessagesBtn")
    ?.addEventListener(
      "click",
      openSearchModal
    );

  $("globalSearchInput")
    ?.addEventListener(
      "input",
      event => {

        searchMessages(
          event.target.value
        );

      }
    );

  $("messageSearchInput")
    ?.addEventListener(
      "input",
      event => {

        CommunityState.searchTerm =
          event.target.value.trim();

        if ($("clearSearchBtn")) {

          $("clearSearchBtn")
            .classList.toggle(
              "hidden",
              !CommunityState.searchTerm
            );
        }

        renderMessages();

      }
    );

  $("clearSearchBtn")
    ?.addEventListener(
      "click",
      () => {

        $("messageSearchInput").value =
          "";

        CommunityState.searchTerm =
          "";

        $("clearSearchBtn")
          .classList.add(
            "hidden"
          );

        renderMessages();

      }
    );

  $("memberSearchInput")
    ?.addEventListener(
      "input",
      renderMembers
    );

  $("refreshCommunitiesBtn")
    ?.addEventListener(
      "click",
      loadCommunities
    );

  $("addChannelBtn")
    ?.addEventListener(
      "click",
      () => {

        if (!CommunityState.activeCommunityId) {

          showToast(
            "Select a community first.",
            "error"
          );

          return;
        }

        openModal(
          "channelModal"
        );

      }
    );

  $("channelForm")
    ?.addEventListener(
      "submit",
      createChannel
    );

  document
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          closeModal(
            button.dataset.closeModal
          );

        }
      );

    });

  document
    .querySelectorAll(
      ".modal-backdrop"
    )
    .forEach(backdrop => {

      backdrop.addEventListener(
        "click",
        event => {

          const modal =
            event.currentTarget
              .closest(".modal");

          if (modal) {
            modal.classList.add(
              "hidden"
            );
          }

        }
      );

    });

  $("communitySettingsBtn")
    ?.addEventListener(
      "click",
      () => {

        showToast(
          "Community settings will be available in the administration phase.",
          "success"
        );

      }
    );

  document.addEventListener(
    "keydown",
    handleGlobalKeyboard
  );

  document.addEventListener(
    "click",
    event => {

      const contextMenu =
        $("messageContextMenu");

      if (
        contextMenu &&
        !contextMenu.contains(
          event.target
        )
      ) {

        contextMenu.classList.add(
          "hidden"
        );
      }

    }
  );

  window.addEventListener(
    "beforeunload",
    () => {

      setOfflinePresence();

    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {

      if (!document.hidden) {

        updateOwnPresence();

        loadPresence();

      }

    }
  );
}


/* ============================================================
   OFFLINE PRESENCE
============================================================ */

async function setOfflinePresence() {

  if (!CommunityState.user) {
    return;
  }

  try {

    await communitySupabase
      .from("chat_presence")
      .update({
        online: false,
        last_seen:
          new Date().toISOString()
      })
      .eq(
        "user_id",
        CommunityState.user.id
      );

  } catch (_) {}
}


/* ============================================================
   PERIODIC PRESENCE
============================================================ */

function startPresenceHeartbeat() {

  updateOwnPresence();

  setInterval(
    updateOwnPresence,
    30000
  );

  setInterval(
    loadPresence,
    30000
  );
}


/* ============================================================
   AUTH STATE
============================================================ */

function setupAuthListener() {

  if (!communitySupabase) {
    return;
  }

  communitySupabase.auth
    .onAuthStateChange(
      async (
        event,
        session
      ) => {

        console.log(
          "🔐 Community auth state:",
          event
        );

        if (
          session?.user
        ) {

          CommunityState.user =
            session.user;

          await loadStudentProfile();

        } else {

          CommunityState.user =
            null;

          showToast(
            "Please sign in to use Mwaniki Community.",
            "error"
          );

        }

      }
    );
}


/* ============================================================
   INITIALIZE
============================================================ */

async function initializeCommunity() {

  if (
    CommunityState.initialized
  ) {
    return;
  }

  CommunityState.initialized =
    true;

  console.log(
    "🚀 Initializing Mwaniki Community..."
  );

  setupEventListeners();

  const user =
    await getCurrentUser();

  if (!user) {

    console.warn(
      "⚠️ No authenticated community user."
    );

    showToast(
      "Please sign in to access Mwaniki Community.",
      "error"
    );

    return;
  }

  await loadStudentProfile();

  await loadCommunities();

  await loadNotifications();

  await loadPresence();

  startPresenceHeartbeat();

  console.log(
    "✅ Mwaniki Community ready."
  );
}


/* ============================================================
   START
============================================================ */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeCommunity
  );

} else {

  initializeCommunity();
}


/* ============================================================
   GLOBAL DEBUG ACCESS
============================================================ */

window.MwanikiCommunity =
  {
    state:
      CommunityState,

    reloadCommunities:
      loadCommunities,

    reloadChannels:
      () =>
        CommunityState.activeCommunityId
          ? loadChannels(
              CommunityState.activeCommunityId
            )
          : null,

    reloadMessages:
      () =>
        CommunityState.activeChannelId
          ? loadMessages(
              CommunityState.activeChannelId
            )
          : null,

    reloadMembers:
      loadMembers,

    reloadNotifications:
      loadNotifications
  };

console.log(
  "✅ Mwaniki Community Phase 2 JavaScript loaded."
);
