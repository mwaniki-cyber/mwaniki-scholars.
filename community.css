/* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY / DISCORD-STYLE INTERFACE
   PHASE 3
========================================================= */

:root {
    --primary: #087f73;
    --primary-dark: #05665d;
    --primary-soft: #e7f3f1;

    --accent: #0b7285;
    --accent-soft: #e8f5f7;

    --text: #173b3a;
    --text-soft: #55706e;
    --text-muted: #81918f;

    --background: #f5f8f8;
    --surface: #ffffff;
    --surface-soft: #f7faf9;

    --border: #dce8e6;
    --border-dark: #c8d8d5;

    --success: #1b9a59;
    --warning: #d89116;
    --danger: #d64545;

    --sidebar: #123d3b;
    --sidebar-dark: #0d302e;
    --sidebar-hover: rgba(255, 255, 255, 0.08);
    --sidebar-active: rgba(255, 255, 255, 0.14);

    --online: #31b86b;
    --offline: #879694;

    --shadow-small:
        0 2px 10px rgba(15, 54, 52, 0.07);

    --shadow:
        0 10px 35px rgba(15, 54, 52, 0.12);

    --radius-small: 8px;
    --radius: 12px;
    --radius-large: 18px;

    --sidebar-width: 285px;
    --member-width: 275px;
    --header-height: 76px;

    --content-max-width: 1200px;
}


/* =========================================================
   RESET
========================================================= */

* {
    box-sizing: border-box;
}

html,
body {
    width: 100%;
    min-height: 100%;
    margin: 0;
    padding: 0;
}

html {
    scroll-behavior: smooth;
}

body {
    font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;

    color: var(--text);
    background: var(--background);

    overflow: hidden;
}

button,
input,
textarea,
select {
    font: inherit;
}

button {
    cursor: pointer;
}

button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
}

input,
textarea,
select {
    outline: none;
}

.hidden {
    display: none !important;
}


/* =========================================================
   MAIN APP
========================================================= */

.community-app {
    display: grid;
    grid-template-columns:
        var(--sidebar-width)
        minmax(0, 1fr)
        var(--member-width);

    width: 100vw;
    height: 100vh;

    overflow: hidden;
}


/* =========================================================
   LEFT SIDEBAR
========================================================= */

.community-sidebar {
    display: flex;
    flex-direction: column;

    min-width: 0;
    height: 100vh;

    color: #ffffff;

    background:
        linear-gradient(
            180deg,
            var(--sidebar) 0%,
            var(--sidebar-dark) 100%
        );

    border-right: 1px solid rgba(255, 255, 255, 0.06);

    position: relative;
    z-index: 30;
}


/* =========================================================
   SIDEBAR HEADER
========================================================= */

.community-sidebar-header {
    min-height: var(--header-height);

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 12px 16px;

    border-bottom:
        1px solid rgba(255, 255, 255, 0.08);
}

.community-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
}

.community-brand-icon {
    width: 40px;
    height: 40px;

    flex: 0 0 40px;

    display: grid;
    place-items: center;

    border-radius: 11px;

    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.5px;

    color: var(--primary);

    background: #ffffff;
}

.community-brand-title {
    font-size: 14px;
    font-weight: 800;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.community-brand-subtitle {
    margin-top: 2px;

    font-size: 11px;
    color: rgba(255, 255, 255, 0.58);
}


/* =========================================================
   COMMUNITY SWITCHER
========================================================= */

.community-switcher-wrapper {
    position: relative;
    padding: 12px 12px 7px;
}

.community-switcher {
    width: 100%;

    display: flex;
    align-items: center;

    gap: 10px;

    padding: 9px;

    border: 0;
    border-radius: 11px;

    color: #ffffff;

    background:
        rgba(255, 255, 255, 0.07);

    text-align: left;

    transition:
        background 0.2s ease,
        transform 0.2s ease;
}

.community-switcher:hover,
.community-switcher[aria-expanded="true"] {
    background:
        rgba(255, 255, 255, 0.12);
}

.community-switcher-icon {
    width: 38px;
    height: 38px;

    display: grid;
    place-items: center;

    flex: 0 0 38px;

    border-radius: 10px;

    background:
        linear-gradient(
            135deg,
            #ffffff,
            #d9efec
        );

    color: var(--primary);

    font-size: 11px;
    font-weight: 900;
}

.community-switcher-info {
    flex: 1;
    min-width: 0;

    display: flex;
    flex-direction: column;
}

.community-switcher-info strong {
    font-size: 13px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.community-switcher-info span {
    margin-top: 2px;

    font-size: 10px;

    color:
        rgba(255, 255, 255, 0.55);
}

.switcher-arrow {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.55);
}


/* =========================================================
   SWITCHER MENU
========================================================= */

.community-switcher-menu {
    position: absolute;

    top: calc(100% - 2px);
    left: 12px;
    right: 12px;

    z-index: 100;

    padding: 8px;

    border:
        1px solid rgba(255, 255, 255, 0.12);

    border-radius: 13px;

    background:
        #183f3d;

    box-shadow:
        0 20px 50px rgba(0, 0, 0, 0.28);
}

.switcher-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 7px 8px 9px;

    color: rgba(255, 255, 255, 0.55);

    font-size: 10px;
    font-weight: 800;

    text-transform: uppercase;
    letter-spacing: 0.7px;
}

.small-create-button {
    width: 26px;
    height: 26px;

    border: 0;
    border-radius: 7px;

    color: #ffffff;
    background: var(--primary);

    font-size: 17px;
}

.small-create-button:hover {
    background: #099889;
}

.community-list {
    max-height: 330px;
    overflow-y: auto;
}

.community-list::-webkit-scrollbar,
.channel-navigation::-webkit-scrollbar,
.member-list::-webkit-scrollbar,
.messages-list::-webkit-scrollbar {
    width: 5px;
}

.community-list::-webkit-scrollbar-thumb,
.channel-navigation::-webkit-scrollbar-thumb,
.member-list::-webkit-scrollbar-thumb,
.messages-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.16);
    border-radius: 20px;
}

.community-list-item {
    width: 100%;

    display: flex;
    align-items: center;
    gap: 9px;

    padding: 8px;

    border: 0;
    border-radius: 8px;

    color: rgba(255, 255, 255, 0.86);
    background: transparent;

    text-align: left;
}

.community-list-item:hover {
    background: var(--sidebar-hover);
}

.community-list-item.active {
    background: var(--sidebar-active);
}

.community-list-item-icon {
    width: 34px;
    height: 34px;

    flex: 0 0 34px;

    display: grid;
    place-items: center;

    border-radius: 9px;

    color: var(--primary);
    background: #ffffff;

    font-size: 10px;
    font-weight: 900;
}

.community-list-item-text {
    flex: 1;
    min-width: 0;
}

.community-list-item-text strong {
    display: block;

    font-size: 12px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.community-list-item-text span {
    display: block;

    margin-top: 2px;

    font-size: 10px;

    color: rgba(255, 255, 255, 0.48);
}

.community-list-item-role {
    font-size: 9px;
    font-weight: 700;

    color:
        rgba(255, 255, 255, 0.42);

    text-transform: uppercase;
}

.switcher-menu-footer {
    margin-top: 6px;
    padding-top: 7px;

    border-top:
        1px solid rgba(255, 255, 255, 0.08);
}

.switcher-footer-button {
    width: 100%;

    padding: 8px;

    border: 0;
    border-radius: 8px;

    color:
        rgba(255, 255, 255, 0.7);

    background: transparent;

    font-size: 11px;
    text-align: left;
}

.switcher-footer-button:hover {
    background: var(--sidebar-hover);
    color: #ffffff;
}


/* =========================================================
   SIDEBAR SEARCH
========================================================= */

.sidebar-search-wrapper {
    padding: 7px 12px 8px;
}

.sidebar-search {
    display: flex;
    align-items: center;
    gap: 7px;

    height: 36px;

    padding: 0 9px;

    border:
        1px solid rgba(255, 255, 255, 0.07);

    border-radius: 9px;

    background:
        rgba(0, 0, 0, 0.13);
}

.search-icon {
    color:
        rgba(255, 255, 255, 0.42);

    font-size: 17px;
}

.sidebar-search input {
    width: 100%;

    border: 0;
    outline: 0;

    color: #ffffff;
    background: transparent;

    font-size: 11px;
}

.sidebar-search input::placeholder {
    color:
        rgba(255, 255, 255, 0.42);
}

.clear-search-button {
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
}


/* =========================================================
   COMMUNITY INFO
========================================================= */

.community-info-block {
    padding: 10px 15px 7px;
}

.community-info-name {
    display: flex;
    align-items: center;
    gap: 6px;

    font-size: 11px;
    font-weight: 900;

    text-transform: uppercase;
    letter-spacing: 0.6px;
}

.community-info-description {
    margin-top: 5px;

    color:
        rgba(255, 255, 255, 0.42);

    font-size: 10px;
    line-height: 1.4;

    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;

    overflow: hidden;
}

.mini-private-badge {
    padding: 2px 5px;

    border-radius: 5px;

    background:
        rgba(216, 145, 22, 0.2);

    color:
        #eab85e;

    font-size: 8px;
    letter-spacing: 0;
}


/* =========================================================
   CHANNEL NAVIGATION
========================================================= */

.channel-navigation {
    flex: 1;

    min-height: 0;

    overflow-y: auto;

    padding: 4px 9px 10px;
}

.channel-category {
    margin-bottom: 12px;
}

.channel-category-header {
    width: 100%;

    display: flex;
    align-items: center;
    gap: 5px;

    padding: 4px 7px;

    border: 0;
    background: transparent;

    color:
        rgba(255, 255, 255, 0.48);

    font-size: 9px;
    font-weight: 900;

    text-transform: uppercase;
    letter-spacing: 0.8px;

    text-align: left;
}

.channel-category-header:hover {
    color:
        rgba(255, 255, 255, 0.78);
}

.category-chevron {
    font-size: 10px;
}

.category-create-button {
    margin-left: auto;

    width: 21px;
    height: 21px;

    display: grid;
    place-items: center;

    border: 0;
    border-radius: 5px;

    color:
        rgba(255, 255, 255, 0.45);

    background: transparent;
}

.category-create-button:hover {
    color: #ffffff;
    background: var(--sidebar-hover);
}

.channel-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.channel-item {
    width: 100%;

    display: flex;
    align-items: center;
    gap: 8px;

    min-height: 35px;

    padding: 6px 8px;

    border: 0;
    border-radius: 8px;

    color:
        rgba(255, 255, 255, 0.58);

    background: transparent;

    text-align: left;

    transition:
        background 0.15s ease,
        color 0.15s ease;
}

.channel-item:hover {
    color: #ffffff;
    background: var(--sidebar-hover);
}

.channel-item.active {
    color: #ffffff;
    background: var(--sidebar-active);
}

.channel-item-icon {
    width: 20px;

    flex: 0 0 20px;

    text-align: center;

    font-size: 17px;
    opacity: 0.65;
}

.channel-item.active .channel-item-icon {
    opacity: 1;
}

.channel-item-name {
    flex: 1;
    min-width: 0;

    font-size: 12px;
    font-weight: 600;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.channel-item-course {
    display: block;

    margin-top: 1px;

    font-size: 8px;

    color:
        rgba(255, 255, 255, 0.37);

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.channel-item-meta {
    display: flex;
    align-items: center;
    gap: 4px;
}

.channel-unread {
    min-width: 18px;
    height: 18px;

    padding: 0 5px;

    display: grid;
    place-items: center;

    border-radius: 20px;

    color: #ffffff;
    background: var(--danger);

    font-size: 9px;
    font-weight: 900;
}

.channel-lock {
    font-size: 11px;
    opacity: 0.65;
}

.channel-settings-button {
    display: none;

    width: 21px;
    height: 21px;

    padding: 0;

    border: 0;
    border-radius: 5px;

    color: rgba(255, 255, 255, 0.55);
    background: transparent;

    font-size: 11px;
}

.channel-item:hover .channel-settings-button {
    display: grid;
    place-items: center;
}

.channel-settings-button:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
}


/* =========================================================
   SIDEBAR FOOTER
========================================================= */

.community-sidebar-footer {
    display: flex;
    align-items: center;
    gap: 8px;

    min-height: 64px;

    padding: 9px 11px;

    border-top:
        1px solid rgba(255, 255, 255, 0.08);

    background:
        rgba(0, 0, 0, 0.12);
}

.current-user-mini {
    min-width: 0;

    flex: 1;

    display: flex;
    align-items: center;
    gap: 8px;
}

.current-user-info {
    min-width: 0;

    display: flex;
    flex-direction: column;
}

.current-user-info strong {
    color: #ffffff;

    font-size: 11px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.current-user-info span {
    margin-top: 2px;

    color:
        rgba(255, 255, 255, 0.43);

    font-size: 9px;
}

.sidebar-footer-actions {
    display: flex;
    gap: 3px;
}

.footer-action-button {
    width: 28px;
    height: 28px;

    display: grid;
    place-items: center;

    border: 0;
    border-radius: 7px;

    color:
        rgba(255, 255, 255, 0.48);

    background: transparent;
}

.footer-action-button:hover {
    color: #ffffff;
    background: var(--sidebar-hover);
}


/* =========================================================
   AVATARS
========================================================= */

.avatar {
    position: relative;

    display: grid;
    place-items: center;

    flex: 0 0 auto;

    border-radius: 50%;

    color: #ffffff;

    background:
        linear-gradient(
            135deg,
            var(--primary),
            var(--accent)
        );

    font-weight: 800;
}

.avatar-small {
    width: 34px;
    height: 34px;

    font-size: 10px;
}

.avatar-medium {
    width: 40px;
    height: 40px;

    font-size: 11px;
}

.avatar-large {
    width: 46px;
    height: 46px;

    font-size: 12px;
}

.avatar img {
    width: 100%;
    height: 100%;

    object-fit: cover;

    border-radius: inherit;
}

.presence-dot {
    position: absolute;

    right: -1px;
    bottom: -1px;

    width: 10px;
    height: 10px;

    border: 2px solid var(--surface);

    border-radius: 50%;

    background: var(--offline);
}

.presence-dot.online {
    background: var(--online);
}


/* =========================================================
   MAIN AREA
========================================================= */

.community-main {
    min-width: 0;

    height: 100vh;

    display: flex;
    flex-direction: column;

    background: var(--surface);
}


/* =========================================================
   MAIN HEADER
========================================================= */

.community-main-header {
    height: var(--header-height);

    flex: 0 0 var(--header-height);

    display: flex;
    align-items: center;
    justify-content: space-between;

    gap: 15px;

    padding: 0 18px;

    border-bottom:
        1px solid var(--border);

    background: var(--surface);

    z-index: 10;
}

.main-header-left {
    min-width: 0;

    display: flex;
    align-items: center;
    gap: 10px;
}

.channel-header-icon {
    width: 38px;
    height: 38px;

    display: grid;
    place-items: center;

    flex: 0 0 38px;

    border-radius: 10px;

    color: var(--primary);

    background: var(--primary-soft);

    font-size: 21px;
    font-weight: 700;
}

.channel-header-information {
    min-width: 0;
}

.channel-header-title-row {
    display: flex;
    align-items: center;
    gap: 7px;
}

.channel-header-title-row h1 {
    margin: 0;

    max-width: 430px;

    color: var(--text);

    font-size: 16px;
    font-weight: 850;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.channel-header-information p {
    margin: 3px 0 0;

    max-width: 600px;

    color: var(--text-muted);

    font-size: 10px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.channel-privacy-badge {
    padding: 3px 6px;

    border-radius: 5px;

    color: var(--success);
    background: #eaf8f0;

    font-size: 8px;
    font-weight: 800;

    text-transform: uppercase;
}

.channel-privacy-badge.private {
    color: var(--warning);
    background: #fff5df;
}

.main-header-actions {
    display: flex;
    align-items: center;
    gap: 5px;
}

.header-action-button {
    position: relative;

    width: 37px;
    height: 37px;

    display: grid;
    place-items: center;

    padding: 0;

    border: 0;
    border-radius: 9px;

    color: var(--text-soft);
    background: transparent;

    font-size: 16px;
}

.header-action-button:hover {
    color: var(--primary);
    background: var(--primary-soft);
}

.active-course-badge {
    max-width: 220px;

    display: flex;
    align-items: center;
    gap: 6px;

    margin-right: 5px;

    padding: 7px 10px;

    border:
        1px solid var(--border);

    border-radius: 8px;

    color: var(--accent);

    background: var(--accent-soft);

    font-size: 10px;
    font-weight: 700;

    white-space: nowrap;
    overflow: hidden;
}

.active-course-badge span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
}

.notification-badge {
    position: absolute;

    top: 1px;
    right: 1px;

    min-width: 17px;
    height: 17px;

    padding: 0 4px;

    display: grid;
    place-items: center;

    border: 2px solid var(--surface);

    border-radius: 20px;

    color: #ffffff;
    background: var(--danger);

    font-size: 8px;
    font-weight: 900;
}


/* =========================================================
   MESSAGE SEARCH
========================================================= */

.message-search-panel {
    padding: 10px 18px;

    border-bottom:
        1px solid var(--border);

    background:
        var(--surface-soft);
}

.message-search-inner {
    display: flex;
    gap: 8px;
}

.message-search-input-wrapper {
    flex: 1;

    display: flex;
    align-items: center;
    gap: 7px;

    height: 38px;

    padding: 0 10px;

    border:
        1px solid var(--border);

    border-radius: 9px;

    background: #ffffff;
}

.message-search-input-wrapper input {
    flex: 1;

    border: 0;

    color: var(--text);
    background: transparent;

    font-size: 11px;
}

.message-search-input-wrapper button {
    width: 25px;
    height: 25px;

    border: 0;
    border-radius: 5px;

    color: var(--text-muted);
    background: transparent;
}

.primary-button {
    min-height: 38px;

    padding: 0 15px;

    border: 0;
    border-radius: 8px;

    color: #ffffff;

    background: var(--primary);

    font-size: 11px;
    font-weight: 800;
}

.primary-button:hover {
    background: var(--primary-dark);
}

.secondary-button {
    min-height: 38px;

    padding: 0 15px;

    border:
        1px solid var(--border);

    border-radius: 8px;

    color: var(--text-soft);
    background: #ffffff;

    font-size: 11px;
    font-weight: 700;
}

.secondary-button:hover {
    background: var(--surface-soft);
}

.message-search-results {
    max-height: 280px;
    overflow-y: auto;

    margin-top: 9px;
}

.search-result {
    padding: 9px;

    border-bottom:
        1px solid var(--border);

    cursor: pointer;
}

.search-result:hover {
    background: var(--primary-soft);
}

.search-result-author {
    font-size: 11px;
    font-weight: 800;
}

.search-result-date {
    margin-left: 6px;

    color: var(--text-muted);

    font-size: 9px;
}

.search-result-content {
    margin-top: 4px;

    color: var(--text-soft);

    font-size: 11px;
    line-height: 1.45;
}


/* =========================================================
   MESSAGES AREA
========================================================= */

.messages-area {
    position: relative;

    flex: 1;

    min-height: 0;

    display: flex;
    flex-direction: column;

    overflow: hidden;

    background: #ffffff;
}

.messages-list {
    flex: 1;

    min-height: 0;

    overflow-y: auto;

    padding: 10px 0 20px;
}

.messages-list::-webkit-scrollbar-thumb {
    background: var(--border-dark);
}


/* =========================================================
   CHANNEL WELCOME
========================================================= */

.channel-welcome {
    padding: 35px 24px 20px;

    max-width: var(--content-max-width);

    width: 100%;

    margin: 0 auto;
}

.channel-welcome-icon {
    width: 48px;
    height: 48px;

    display: grid;
    place-items: center;

    border-radius: 14px;

    color: var(--primary);

    background: var(--primary-soft);

    font-size: 27px;
    font-weight: 800;
}

.channel-welcome h2 {
    margin: 12px 0 5px;

    color: var(--text);

    font-size: 20px;
}

.channel-welcome h2 span {
    color: var(--primary);
}

.channel-welcome p {
    margin: 0;

    max-width: 650px;

    color: var(--text-muted);

    font-size: 11px;
    line-height: 1.5;
}


/* =========================================================
   MESSAGE
========================================================= */

.message-row {
    position: relative;

    display: flex;

    gap: 10px;

    max-width: var(--content-max-width);

    margin: 0 auto;

    padding: 7px 24px;

    transition:
        background 0.15s ease;
}

.message-row:hover {
    background:
        rgba(8, 127, 115, 0.025);
}

.message-row.grouped {
    padding-top: 2px;
}

.message-row.grouped .message-avatar-column {
    visibility: hidden;
}

.message-avatar-column {
    width: 40px;

    flex: 0 0 40px;
}

.message-content-column {
    min-width: 0;

    flex: 1;
}

.message-author-line {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;

    gap: 7px;
}

.message-author {
    color: var(--text);

    font-size: 11px;
    font-weight: 850;
}

.message-role {
    padding: 2px 5px;

    border-radius: 4px;

    color: var(--primary);

    background: var(--primary-soft);

    font-size: 7px;
    font-weight: 900;

    text-transform: uppercase;
}

.message-time {
    color: var(--text-muted);

    font-size: 8px;
}

.message-edited {
    color: var(--text-muted);

    font-size: 8px;
}

.message-content {
    margin-top: 3px;

    color: #314b49;

    font-size: 11px;

    line-height: 1.55;

    white-space: pre-wrap;

    overflow-wrap: anywhere;
}

.message-content a {
    color: var(--accent);
}

.message-reply-preview {
    margin-bottom: 5px;

    padding: 5px 8px;

    border-left:
        3px solid var(--primary);

    border-radius: 4px;

    background: var(--surface-soft);

    color: var(--text-muted);

    font-size: 9px;
}

.message-actions {
    position: absolute;

    right: 25px;
    top: -12px;

    display: none;

    align-items: center;

    padding: 3px;

    border:
        1px solid var(--border);

    border-radius: 7px;

    background: #ffffff;

    box-shadow: var(--shadow-small);

    z-index: 5;
}

.message-row:hover .message-actions {
    display: flex;
}

.message-action {
    width: 27px;
    height: 27px;

    display: grid;
    place-items: center;

    padding: 0;

    border: 0;
    border-radius: 5px;

    color: var(--text-soft);

    background: transparent;

    font-size: 12px;
}

.message-action:hover {
    color: var(--primary);
    background: var(--primary-soft);
}

.message-action.danger:hover {
    color: var(--danger);
    background: #fff0f0;
}


/* =========================================================
   REACTIONS
========================================================= */

.message-reactions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;

    margin-top: 5px;
}

.reaction-chip {
    min-height: 23px;

    display: inline-flex;
    align-items: center;
    gap: 4px;

    padding: 2px 7px;

    border:
        1px solid var(--border);

    border-radius: 7px;

    color: var(--text-soft);

    background: #ffffff;

    font-size: 10px;
}

.reaction-chip:hover,
.reaction-chip.reacted {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-soft);
}

.reaction-count {
    font-size: 9px;
    font-weight: 800;
}


/* =========================================================
   ATTACHMENTS
========================================================= */

.message-attachments {
    display: flex;
    flex-direction: column;
    gap: 6px;

    margin-top: 7px;
}

.message-attachment {
    max-width: 430px;

    display: flex;
    align-items: center;
    gap: 9px;

    padding: 9px;

    border:
        1px solid var(--border);

    border-radius: 9px;

    background: var(--surface-soft);
}

.attachment-icon {
    width: 32px;
    height: 32px;

    display: grid;
    place-items: center;

    border-radius: 7px;

    background: var(--primary-soft);

    font-size: 14px;
}

.attachment-details {
    min-width: 0;

    display: flex;
    flex-direction: column;
}

.attachment-details strong {
    color: var(--text);

    font-size: 10px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.attachment-details span {
    margin-top: 2px;

    color: var(--text-muted);

    font-size: 8px;
}


/* =========================================================
   LOADING / EMPTY
========================================================= */

.messages-loading,
.members-loading,
.loading-sidebar,
.loading-small {
    min-height: 100px;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    color: var(--text-muted);

    font-size: 10px;
}

.loading-spinner {
    width: 23px;
    height: 23px;

    margin-bottom: 8px;

    border:
        3px solid var(--border);

    border-top-color: var(--primary);

    border-radius: 50%;

    animation:
        communitySpin 0.8s linear infinite;
}

@keyframes communitySpin {
    to {
        transform: rotate(360deg);
    }
}

.empty-message-state {
    padding: 45px 20px;

    text-align: center;

    color: var(--text-muted);

    font-size: 11px;
}

.empty-message-state strong {
    display: block;

    margin-bottom: 5px;

    color: var(--text);
}


/* =========================================================
   COMPOSER
========================================================= */

.message-composer-area {
    position: relative;

    padding: 8px 18px 13px;

    border-top:
        1px solid var(--border);

    background: #ffffff;
}

.reply-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;

    max-width: var(--content-max-width);

    margin: 0 auto 7px;

    padding: 7px 10px;

    border-left:
        3px solid var(--primary);

    border-radius: 6px;

    background: var(--primary-soft);

    font-size: 9px;
}

.reply-banner strong {
    margin-right: 5px;
    color: var(--primary);
}

.reply-banner span {
    color: var(--text-soft);
}

.reply-banner button {
    width: 24px;
    height: 24px;

    border: 0;
    border-radius: 5px;

    color: var(--text-muted);
    background: transparent;
}

.message-composer {
    max-width: var(--content-max-width);

    min-height: 48px;

    margin: 0 auto;

    display: flex;
    align-items: flex-end;

    gap: 7px;

    padding: 7px;

    border:
        1px solid var(--border-dark);

    border-radius: 12px;

    background: var(--surface-soft);

    transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
}

.message-composer:focus-within {
    border-color: var(--primary);
    box-shadow:
        0 0 0 3px rgba(8, 127, 115, 0.08);
}

.message-composer textarea {
    flex: 1;

    min-height: 30px;
    max-height: 150px;

    resize: none;

    padding: 6px 3px;

    border: 0;

    color: var(--text);

    background: transparent;

    font-size: 11px;
    line-height: 1.45;
}

.message-composer textarea::placeholder {
    color: var(--text-muted);
}

.composer-actions {
    display: flex;
    align-items: center;
    gap: 3px;
}

.composer-icon-button {
    width: 32px;
    height: 32px;

    display: grid;
    place-items: center;

    padding: 0;

    border: 0;
    border-radius: 7px;

    color: var(--text-muted);
    background: transparent;

    font-size: 16px;
}

.composer-icon-button:hover {
    color: var(--primary);
    background: var(--primary-soft);
}

.send-message-button {
    width: 34px;
    height: 34px;

    display: grid;
    place-items: center;

    border: 0;
    border-radius: 8px;

    color: #ffffff;

    background: var(--primary);

    font-size: 14px;
}

.send-message-button:hover {
    background: var(--primary-dark);
}

.composer-hint {
    max-width: var(--content-max-width);

    margin: 5px auto 0;

    display: flex;
    justify-content: space-between;

    color: var(--text-muted);

    font-size: 8px;
}

.composer-permission-message {
    max-width: var(--content-max-width);

    margin: 0 auto;

    padding: 11px;

    border-radius: 8px;

    color: var(--warning);

    background: #fff8e9;

    text-align: center;

    font-size: 10px;
    font-weight: 700;
}


/* =========================================================
   RIGHT MEMBER SIDEBAR
========================================================= */

.member-sidebar {
    height: 100vh;

    min-width: 0;

    display: flex;
    flex-direction: column;

    border-left:
        1px solid var(--border);

    background: #f9fbfb;
}

.member-sidebar-header {
    height: var(--header-height);

    flex: 0 0 var(--header-height);

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 15px;

    border-bottom:
        1px solid var(--border);
}

.member-sidebar-header > div {
    display: flex;
    align-items: center;
    gap: 6px;
}

.member-sidebar-header strong {
    font-size: 12px;
}

.member-count {
    min-width: 20px;
    height: 20px;

    display: grid;
    place-items: center;

    border-radius: 20px;

    color: var(--text-muted);
    background: #edf3f2;

    font-size: 9px;
    font-weight: 800;
}

.member-search-wrapper {
    padding: 10px 12px;
}

.member-search-wrapper input {
    width: 100%;
    height: 34px;

    padding: 0 9px;

    border:
        1px solid var(--border);

    border-radius: 8px;

    color: var(--text);

    background: #ffffff;

    font-size: 10px;
}

.member-list {
    flex: 1;

    min-height: 0;

    overflow-y: auto;

    padding: 3px 10px 15px;
}

.member-group {
    margin-bottom: 13px;
}

.member-group-title {
    padding: 5px 6px;

    color: var(--text-muted);

    font-size: 8px;
    font-weight: 900;

    text-transform: uppercase;
    letter-spacing: 0.8px;
}

.member-item {
    width: 100%;

    display: flex;
    align-items: center;
    gap: 8px;

    padding: 7px;

    border: 0;
    border-radius: 8px;

    background: transparent;

    text-align: left;
}

.member-item:hover {
    background: var(--primary-soft);
}

.member-item-info {
    min-width: 0;

    flex: 1;

    display: flex;
    flex-direction: column;
}

.member-item-info strong {
    color: var(--text);

    font-size: 10px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.member-item-info span {
    margin-top: 2px;

    color: var(--text-muted);

    font-size: 8px;
}

.member-role-label {
    font-size: 8px;
    font-weight: 800;

    color: var(--text-muted);

    text-transform: capitalize;
}


/* =========================================================
   FLOATING NOTIFICATIONS
========================================================= */

.floating-panel {
    position: fixed;

    z-index: 200;

    width: min(380px, calc(100vw - 30px));

    border:
        1px solid var(--border);

    border-radius: 13px;

    background: #ffffff;

    box-shadow: var(--shadow);
}

.notification-panel {
    top: 66px;
    right: calc(var(--member-width) + 15px);
}

.floating-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 12px;

    border-bottom:
        1px solid var(--border);
}

.floating-panel-header > div {
    display: flex;
    align-items: center;
    gap: 6px;
}

.floating-panel-header strong {
    font-size: 11px;
}

.floating-panel-header span {
    min-width: 18px;
    height: 18px;

    display: grid;
    place-items: center;

    border-radius: 20px;

    color: #ffffff;
    background: var(--danger);

    font-size: 8px;
}

.floating-panel-header button {
    border: 0;

    color: var(--primary);
    background: transparent;

    font-size: 9px;
    font-weight: 800;
}

.notification-content {
    max-height: 400px;

    overflow-y: auto;
}

.notification-item {
    display: block;

    padding: 10px 12px;

    border-bottom:
        1px solid var(--border);

    cursor: pointer;
}

.notification-item:hover {
    background: var(--surface-soft);
}

.notification-item.unread {
    background: var(--primary-soft);
}

.notification-item-title {
    color: var(--text);

    font-size: 10px;
    font-weight: 800;
}

.notification-item-body {
    margin-top: 3px;

    color: var(--text-soft);

    font-size: 9px;
    line-height: 1.4;
}

.notification-item-time {
    margin-top: 5px;

    color: var(--text-muted);

    font-size: 8px;
}

.empty-state-small {
    padding: 25px;

    color: var(--text-muted);

    text-align: center;

    font-size: 10px;
}


/* =========================================================
   MODALS
========================================================= */

.modal-backdrop {
    position: fixed;
    inset: 0;

    z-index: 500;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 20px;

    background:
        rgba(8, 31, 30, 0.48);

    backdrop-filter:
        blur(3px);
}

.modal-card {
    width: min(520px, 100%);

    max-height:
        calc(100vh - 40px);

    overflow-y: auto;

    padding: 20px;

    border:
        1px solid var(--border);

    border-radius: 17px;

    background: #ffffff;

    box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.22);
}

.small-modal {
    width: min(410px, 100%);
}

.modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;

    gap: 15px;

    margin-bottom: 18px;
}

.modal-header h2 {
    margin: 0;

    color: var(--text);

    font-size: 17px;
}

.modal-header p {
    margin: 4px 0 0;

    color: var(--text-muted);

    font-size: 9px;
    line-height: 1.45;
}

.modal-close {
    width: 30px;
    height: 30px;

    flex: 0 0 30px;

    border: 0;
    border-radius: 7px;

    color: var(--text-muted);

    background: var(--surface-soft);

    font-size: 17px;
}

.modal-close:hover {
    color: var(--danger);
    background: #fff0f0;
}

.modal-card form,
.settings-section {
    display: flex;
    flex-direction: column;
    gap: 13px;
}

.modal-card label {
    display: flex;
    flex-direction: column;
    gap: 5px;

    color: var(--text);

    font-size: 10px;
    font-weight: 800;
}

.modal-card input,
.modal-card textarea,
.modal-card select {
    width: 100%;

    padding: 10px;

    border:
        1px solid var(--border);

    border-radius: 8px;

    color: var(--text);

    background: #ffffff;

    font-size: 11px;
}

.modal-card input:focus,
.modal-card textarea:focus,
.modal-card select:focus {
    border-color: var(--primary);

    box-shadow:
        0 0 0 3px rgba(8, 127, 115, 0.08);
}

.modal-card textarea {
    resize: vertical;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;

    margin-top: 8px;
    padding-top: 13px;

    border-top:
        1px solid var(--border);
}

.form-error {
    padding: 9px 10px;

    border-radius: 7px;

    color: var(--danger);
    background: #fff0f0;

    font-size: 9px;
    line-height: 1.4;
}

.permission-summary {
    padding: 10px;

    border-radius: 8px;

    color: var(--text-soft);

    background: var(--surface-soft);

    font-size: 9px;
    line-height: 1.5;
}


/* =========================================================
   TOAST
========================================================= */

.community-toast {
    position: fixed;

    left: 50%;
    bottom: 25px;

    z-index: 1000;

    transform:
        translateX(-50%)
        translateY(15px);

    min-width: 230px;
    max-width: min(430px, calc(100vw - 30px));

    padding: 11px 15px;

    border:
        1px solid var(--border);

    border-radius: 9px;

    color: var(--text);

    background: #ffffff;

    box-shadow: var(--shadow);

    font-size: 10px;
    font-weight: 700;

    opacity: 0;

    transition:
        opacity 0.2s ease,
        transform 0.2s ease;
}

.community-toast.visible {
    opacity: 1;

    transform:
        translateX(-50%)
        translateY(0);
}

.community-toast.success {
    border-color:
        rgba(27, 154, 89, 0.3);
}

.community-toast.error {
    border-color:
        rgba(214, 69, 69, 0.3);
}


/* =========================================================
   EMOJI PICKER
========================================================= */

.emoji-picker {
    position: fixed;

    z-index: 300;

    display: grid;

    grid-template-columns:
        repeat(4, 35px);

    gap: 3px;

    padding: 7px;

    border:
        1px solid var(--border);

    border-radius: 9px;

    background: #ffffff;

    box-shadow: var(--shadow);
}

.emoji-picker button {
    width: 35px;
    height: 35px;

    border: 0;
    border-radius: 6px;

    background: transparent;

    font-size: 17px;
}

.emoji-picker button:hover {
    background: var(--primary-soft);
}


/* =========================================================
   MOBILE
========================================================= */

.mobile-only {
    display: none;
}

.mobile-overlay {
    display: none;
}


/* =========================================================
   TABLET
========================================================= */

@media (max-width: 1100px) {

    :root {
        --sidebar-width: 255px;
        --member-width: 235px;
    }

    .active-course-badge {
        display: none;
    }

    .channel-header-information p {
        max-width: 400px;
    }
}


/* =========================================================
   SMALL TABLET
========================================================= */

@media (max-width: 850px) {

    :root {
        --member-width: 0px;
    }

    .community-app {
        grid-template-columns:
            var(--sidebar-width)
            minmax(0, 1fr);
    }

    .member-sidebar {
        position: fixed;

        top: 0;
        right: 0;

        width: 300px;

        z-index: 250;

        transform:
            translateX(100%);

        transition:
            transform 0.25s ease;

        box-shadow:
            -15px 0 40px rgba(0, 0, 0, 0.15);
    }

    .member-sidebar.open {
        transform:
            translateX(0);
    }

    .mobile-only {
        display: grid;
    }

    .member-sidebar-header .icon-button {
        display: grid;
    }

    .notification-panel {
        right: 15px;
    }
}


/* =========================================================
   MOBILE
========================================================= */

@media (max-width: 650px) {

    body {
        overflow: hidden;
    }

    .community-app {
        display: block;
    }

    .community-sidebar {
        position: fixed;

        top: 0;
        left: 0;

        width: min(310px, 88vw);

        z-index: 400;

        transform:
            translateX(-100%);

        transition:
            transform 0.25s ease;

        box-shadow:
            15px 0 40px rgba(0, 0, 0, 0.18);
    }

    .community-sidebar.open {
        transform:
            translateX(0);
    }

    .mobile-overlay.visible {
        display: block;

        position: fixed;
        inset: 0;

        z-index: 350;

        background:
            rgba(0, 0, 0, 0.35);
    }

    .community-main {
        width: 100%;
    }

    .community-main-header {
        padding: 0 10px;
    }

    .channel-header-icon {
        width: 32px;
        height: 32px;

        flex-basis: 32px;
    }

    .channel-header-title-row h1 {
        max-width: 190px;

        font-size: 13px;
    }

    .channel-header-information p {
        max-width: 210px;

        font-size: 8px;
    }

    .main-header-actions {
        gap: 0;
    }

    .header-action-button {
        width: 32px;
        height: 32px;

        font-size: 14px;
    }

    .channel-welcome {
        padding:
            25px
            15px
            15px;
    }

    .channel-welcome h2 {
        font-size: 17px;
    }

    .message-row {
        gap: 7px;

        padding:
            7px
            12px;
    }

    .message-avatar-column {
        width: 34px;
        flex-basis: 34px;
    }

    .avatar-medium {
        width: 34px;
        height: 34px;
    }

    .message-actions {
        right: 10px;
    }

    .message-composer-area {
        padding:
            7px
            9px
            10px;
    }

    .composer-hint {
        display: none;
    }

    .message-composer {
        min-height: 45px;
    }

    .message-search-inner {
        flex-direction: column;
    }

    .primary-button {
        width: 100%;
    }

    .notification-panel {
        top: 65px;
        right: 10px;
        left: 10px;

        width: auto;
    }

    .modal-backdrop {
        padding: 10px;
    }

    .modal-card {
        max-height:
            calc(100vh - 20px);

        padding: 15px;
    }
}


/* =========================================================
   VERY SMALL MOBILE
========================================================= */

@media (max-width: 390px) {

    .channel-header-icon {
        display: none;
    }

    .channel-header-title-row h1 {
        max-width: 150px;
    }

    .header-action-button:nth-child(2) {
        display: none;
    }

    .message-author-line {
        gap: 5px;
    }

    .message-content {
        font-size: 10px;
    }
}


/* =========================================================
   ACCESSIBILITY
========================================================= */

button:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
    outline:
        2px solid var(--primary);

    outline-offset: 2px;
}


/* =========================================================
   REDUCED MOTION
========================================================= */

@media (prefers-reduced-motion: reduce) {

    *,
    *::before,
    *::after {
        scroll-behavior: auto !important;
        transition: none !important;
        animation: none !important;
    }
}
