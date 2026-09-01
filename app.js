const REPOSITORY = {
  owner: "5121737085687ybs-hub",
  repo: "5121737085687ybs-hub.github.io",
  branch: "main",
  contentPath: "data/content.json"
};

const state = {
  content: null,
  draft: null,
  filter: "全部作品",
  uploads: new Map(),
  selectedProjectIndex: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const deepCopy = value => JSON.parse(JSON.stringify(value));
const html = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));

function getPath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => current[key], object);
  target[last] = value;
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
}

function render(content = state.content) {
  $$('[data-bind]').forEach(node => {
    node.textContent = getPath(content, node.dataset.bind) ?? "";
  });

  document.title = `${content.site.logo} - 独立设计师`;
  $("#capability-grid").innerHTML = content.capabilities.map(item => `
    <article class="capability">
      <i data-lucide="${html(item.icon)}"></i>
      <h3>${html(item.title)}</h3>
      <p>${html(item.text)}</p>
    </article>`).join("");
  $("#stat-strip").innerHTML = content.stats.map(item => `
    <div class="stat"><strong>${html(item.value)}</strong><span>${html(item.label)}</span></div>`).join("");

  const categories = ["全部作品", ...new Set(content.projects.map(project => project.category).filter(Boolean))];
  if (!categories.includes(state.filter)) state.filter = "全部作品";
  $("#filters").innerHTML = categories.map(category => `
    <button class="filter-button ${category === state.filter ? "is-active" : ""}" type="button" data-filter="${html(category)}">${html(category)}</button>`).join("");
  renderProjects(content);

  $("#about-image").src = content.about.image;
  $("#skills-list").innerHTML = content.about.skills.map(item => `<li>${html(item)}</li>`).join("");
  $("#tools-list").innerHTML = content.about.tools.map(item => `<li>${html(item)}</li>`).join("");
  $("#email-link").href = `mailto:${content.contact.email}`;
  $("#phone-link").href = `tel:${content.contact.phone.replace(/\s/g, "")}`;
  $("#year").textContent = new Date().getFullYear();
  refreshIcons();
}

function renderProjects(content = state.content) {
  const projects = content.projects
    .map((project, originalIndex) => ({ project, originalIndex }))
    .filter(({ project }) => state.filter === "全部作品" || project.category === state.filter);
  $("#work-grid").innerHTML = projects.length ? projects.map(({ project, originalIndex }, index) => `
    <article class="work-card" data-project-index="${originalIndex}" tabindex="0" role="link" aria-label="查看并编辑 ${html(project.title)}">
      <div class="work-media">
        <img src="${html(project.image)}" alt="${html(project.title)}" loading="lazy">
        <span class="work-index">${String(index + 1).padStart(2, "0")}</span>
      </div>
      <div class="work-meta">
        <div><h3>${html(project.title)}</h3><span>${html(project.category)}</span></div>
        <p>${html(project.description)}</p>
      </div>
    </article>`).join("") : `<p class="work-empty">该分类暂无作品</p>`;
  refreshIcons();
}

async function loadContent() {
  const response = await fetch(`data/content.json?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("内容文件加载失败");
  state.content = await response.json();
  state.draft = deepCopy(state.content);
  render();
}

function populateEditor() {
  const form = $("#editor-form");
  $$('[name]', form).forEach(field => {
    const value = getPath(state.draft, field.name);
    field.value = Array.isArray(value) ? value.join("\n") : value ?? "";
  });
  $("#about-preview").src = state.draft.about.image;
  $("#stats-editor").innerHTML = state.draft.stats.map((stat, index) => `
    <div class="pair-row">
      <label>数值<input data-stat="${index}" data-key="value" value="${html(stat.value)}"></label>
      <label>说明<input data-stat="${index}" data-key="label" value="${html(stat.label)}"></label>
    </div>`).join("");
  renderProjectEditors();
}

function renderProjectEditors() {
  $("#projects-editor").innerHTML = state.draft.projects.map((project, index) => `
    <article class="project-editor" data-project="${index}">
      <div class="project-editor-head">
        <strong>${String(index + 1).padStart(2, "0")} / ${html(project.title || "未命名项目")}</strong>
        <div class="project-editor-actions">
          <button class="icon-button" type="button" data-action="up" aria-label="上移" title="上移" ${index === 0 ? "disabled" : ""}><i data-lucide="arrow-up"></i></button>
          <button class="icon-button" type="button" data-action="down" aria-label="下移" title="下移" ${index === state.draft.projects.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down"></i></button>
          <button class="icon-button danger-button" type="button" data-action="delete" aria-label="删除" title="删除"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <label>项目名称<input data-project-field="title" value="${html(project.title)}"></label>
      <label>分类<input data-project-field="category" value="${html(project.category)}"></label>
      <label>项目简介<textarea data-project-field="description" rows="3">${html(project.description)}</textarea></label>
      <div class="project-image-row">
        <img src="${html(project.image)}" alt="项目图片预览">
        <label class="button button-secondary file-button">更换图片<input type="file" data-project-file accept="image/jpeg,image/png,image/webp,image/gif"></label>
      </div>
    </article>`).join("");
  refreshIcons();
}

function openEditor() {
  state.draft = deepCopy(state.content);
  state.uploads.clear();
  state.selectedProjectIndex = null;
  populateEditor();
  $("#github-token").value = sessionStorage.getItem("portfolioGithubToken") || "";
  $("#editor-shell").hidden = false;
  document.body.classList.add("editor-open");
  switchTab("basic");
  $("#edit-close").focus();
}

function closeEditor() {
  $("#editor-shell").hidden = true;
  document.body.classList.remove("editor-open");
  state.selectedProjectIndex = null;
  render(state.content);
  $("#edit-open").focus();
}

function switchTab(tab) {
  $$(".editor-tab").forEach(button => button.classList.toggle("is-active", button.dataset.tab === tab));
  $$(".editor-section").forEach(panel => panel.classList.toggle("is-active", panel.dataset.panel === tab));
}

function updateDraftFromForm(event) {
  const field = event.target;
  if (field.name) {
    const current = getPath(state.draft, field.name);
    setPath(state.draft, field.name, Array.isArray(current)
      ? field.value.split("\n").map(value => value.trim()).filter(Boolean)
      : field.value);
  }
  if (field.dataset.stat !== undefined) {
    state.draft.stats[Number(field.dataset.stat)][field.dataset.key] = field.value;
  }
  if (field.dataset.projectField) {
    const index = Number(field.closest("[data-project]").dataset.project);
    state.draft.projects[index][field.dataset.projectField] = field.value;
  }
  render(state.draft);
}

function projectAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const index = Number(button.closest("[data-project]").dataset.project);
  const action = button.dataset.action;
  if (action === "delete") state.draft.projects.splice(index, 1);
  if (action === "up" && index > 0) [state.draft.projects[index - 1], state.draft.projects[index]] = [state.draft.projects[index], state.draft.projects[index - 1]];
  if (action === "down" && index < state.draft.projects.length - 1) [state.draft.projects[index + 1], state.draft.projects[index]] = [state.draft.projects[index], state.draft.projects[index + 1]];
  renderProjectEditors();
  render(state.draft);
}

function fileExtension(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const allowed = ["jpg", "jpeg", "png", "webp", "gif"];
  return allowed.includes(extension) ? extension : ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type] || "jpg");
}

function queueImage(file, key, assign) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    showToast("单张图片不能超过 8 MB");
    return;
  }
  const url = URL.createObjectURL(file);
  assign(url);
  state.uploads.set(key, { file, assign });
  render(state.draft);
  populateEditor();
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function textToBase64(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

async function githubRequest(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers
    }
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const message = detail.message || `GitHub 请求失败 (${response.status})`;
    if (response.status === 401) throw new Error("访问令牌无效或已失效");
    if (response.status === 403) throw new Error("访问令牌没有写入该仓库的权限");
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

async function putFile(path, base64Content, token, message) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const apiPath = `/repos/${REPOSITORY.owner}/${REPOSITORY.repo}/contents/${encodedPath}`;
  const existing = await githubRequest(`${apiPath}?ref=${REPOSITORY.branch}`, token).catch(error => {
    if (/Not Found/i.test(error.message)) return null;
    throw error;
  });
  return githubRequest(apiPath, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: base64Content,
      branch: REPOSITORY.branch,
      ...(existing?.sha ? { sha: existing.sha } : {})
    })
  });
}

async function publish() {
  const token = $("#github-token").value.trim();
  const button = $("#save-button");
  const status = $("#save-status");
  if (!token) {
    status.textContent = "请输入访问令牌";
    status.className = "save-status is-error";
    $("#github-token").focus();
    return;
  }
  button.disabled = true;
  status.className = "save-status";
  try {
    sessionStorage.setItem("portfolioGithubToken", token);
    const user = await githubRequest("/user", token);
    status.textContent = `已验证 ${user.login}`;

    let uploadIndex = 0;
    for (const [key, upload] of state.uploads) {
      uploadIndex += 1;
      status.textContent = `正在上传图片 ${uploadIndex}/${state.uploads.size}`;
      const extension = fileExtension(upload.file);
      const path = `assets/uploads/${Date.now()}-${uploadIndex}.${extension}`;
      const bytes = new Uint8Array(await upload.file.arrayBuffer());
      await putFile(path, bytesToBase64(bytes), token, `content: upload image ${key}`);
      upload.assign(path);
    }

    status.textContent = "正在提交内容";
    const json = `${JSON.stringify(state.draft, null, 2)}\n`;
    const result = await putFile(REPOSITORY.contentPath, textToBase64(json), token, "content: update portfolio from web editor");
    state.content = deepCopy(state.draft);
    state.uploads.clear();
    render();
    status.textContent = `已提交 ${result.commit.sha.slice(0, 7)}，正在部署`;
    showToast("保存成功，GitHub Pages 通常会在 1-2 分钟内更新");
  } catch (error) {
    status.textContent = error.message;
    status.className = "save-status is-error";
  } finally {
    button.disabled = false;
  }
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3400);
}

function bindEvents() {
  $("#menu-toggle").addEventListener("click", () => $("#site-nav").classList.toggle("is-open"));
  $("#site-nav").addEventListener("click", () => $("#site-nav").classList.remove("is-open"));
  $("#filters").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    render(state.content);
  });
  $("#edit-open").addEventListener("click", openEditor);
  $("#work-grid").addEventListener("click", event => {
    const card = event.target.closest(".work-card[data-project-index]");
    if (card) window.location.href = `project.html?project=${encodeURIComponent(card.dataset.projectIndex)}`;
  });
  $("#work-grid").addEventListener("keydown", event => {
    const card = event.target.closest(".work-card[data-project-index]");
    if (!card || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    window.location.href = `project.html?project=${encodeURIComponent(card.dataset.projectIndex)}`;
  });
  $("#edit-close").addEventListener("click", closeEditor);
  $("#editor-scrim").addEventListener("click", closeEditor);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#editor-shell").hidden) closeEditor();
  });
  $(".editor-tabs").addEventListener("click", event => {
    const tab = event.target.closest("[data-tab]");
    if (tab) switchTab(tab.dataset.tab);
  });
  $("#editor-form").addEventListener("input", updateDraftFromForm);
  $("#projects-editor").addEventListener("click", projectAction);
  $("#project-add").addEventListener("click", () => {
    state.draft.projects.push({ title: "新项目", category: "UI/UX", description: "项目简介", image: state.draft.projects[0]?.image || "" });
    renderProjectEditors();
    render(state.draft);
  });
  $("#about-file").addEventListener("change", event => queueImage(event.target.files[0], "about", url => { state.draft.about.image = url; }));
  $("#projects-editor").addEventListener("change", event => {
    if (!event.target.matches("[data-project-file]")) return;
    const index = Number(event.target.closest("[data-project]").dataset.project);
    queueImage(event.target.files[0], `project-${index}`, url => { state.draft.projects[index].image = url; });
  });
  $("#token-toggle").addEventListener("click", () => {
    const input = $("#github-token");
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    $("#token-toggle").setAttribute("aria-label", showing ? "显示令牌" : "隐藏令牌");
    $("#token-toggle").innerHTML = `<i data-lucide="${showing ? "eye" : "eye-off"}"></i>`;
    refreshIcons();
  });
  $("#save-button").addEventListener("click", publish);

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      $$(".site-nav a").forEach(link => link.classList.toggle("is-current", link.hash === `#${entry.target.id}`));
    }
  }, { rootMargin: "-30% 0px -60%", threshold: 0 });
  $$("main section[id]").forEach(section => observer.observe(section));
}

bindEvents();
loadContent().catch(error => {
  $("main").innerHTML = `<p class="work-empty">${html(error.message)}，请稍后刷新页面。</p>`;
});
refreshIcons();
