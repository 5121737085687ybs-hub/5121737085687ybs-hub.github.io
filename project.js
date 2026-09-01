const REPOSITORY = { owner: "5121737085687ybs-hub", repo: "5121737085687ybs-hub.github.io", branch: "main", contentPath: "data/content.json" };
const query = new URLSearchParams(window.location.search);
const projectIndex = Number(query.get("project"));
const state = { content: null, project: null, media: [], pendingMedia: [] };
const $ = selector => document.querySelector(selector);
const html = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const bytesToBase64 = bytes => { let binary = ""; for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(binary); };
const textToBase64 = value => bytesToBase64(new TextEncoder().encode(value));
const refreshIcons = () => { if (window.lucide) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } }); };

function mediaTypeFromSource(source) { return /\.(mp4|webm|ogg|mov)(?:\?|$)/i.test(source) ? "video" : "image"; }
function normalizeMedia(project) {
  if (Array.isArray(project.media) && project.media.length) return project.media.map(item => ({ type: item.type === "video" ? "video" : "image", src: item.src, alt: item.alt || project.title }));
  return project.image ? [{ type: mediaTypeFromSource(project.image), src: project.image, alt: project.title }] : [];
}
function mediaMarkup(item, alt = "项目媒体") {
  if (item.type === "video") return `<video src="${html(item.src)}" controls preload="metadata" playsinline aria-label="${html(item.alt || alt)}"></video>`;
  return `<img src="${html(item.src)}" alt="${html(item.alt || alt)}" loading="lazy">`;
}

function showError() { $("#project-main").hidden = true; $("#project-edit").hidden = true; $("#project-error").hidden = false; refreshIcons(); }

function render() {
  const { project, content } = state;
  document.title = `${project.title} - ${content.site.logo}`;
  $("#project-logo").textContent = content.site.logo;
  $("#project-category").textContent = project.category || "PROJECT";
  $("#project-story-category").textContent = project.category || "PROJECT";
  $("#project-number").textContent = `PROJECT / ${String(projectIndex + 1).padStart(2, "0")}`;
  $("#project-title").textContent = project.title;
  $("#project-description").textContent = project.description;
  const media = state.media.length ? state.media : normalizeMedia(project);
  state.media = media;
  $("#project-hero-media").innerHTML = media.length ? mediaMarkup(media[0], project.title) : "";
  $("#project-detail").textContent = project.detail || project.description;
  $("#project-gallery").innerHTML = media.slice(1).map((item, index) => `<figure class="project-gallery-item">${mediaMarkup(item, project.title)}<figcaption>${String(index + 2).padStart(2, "0")} / ${item.type === "video" ? "视频" : "图片"}</figcaption></figure>`).join("");
  $("#project-gallery-section").hidden = media.length < 2;
  const previous = content.projects[projectIndex - 1];
  const next = content.projects[projectIndex + 1];
  $("#previous-project").hidden = !previous;
  $("#next-project").hidden = !next;
  if (previous) { $("#previous-project").href = `project.html?project=${projectIndex - 1}`; $("#previous-project strong").textContent = previous.title; }
  if (next) { $("#next-project").href = `project.html?project=${projectIndex + 1}`; $("#next-project strong").textContent = next.title; }
  $("#project-edit").hidden = false;
  refreshIcons();
}

async function load() {
  const response = await fetch(`data/content.json?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("内容文件加载失败");
  state.content = await response.json();
  if (!Number.isInteger(projectIndex) || projectIndex < 0 || projectIndex >= state.content.projects.length) return showError();
  state.project = state.content.projects[projectIndex];
  state.media = normalizeMedia(state.project);
  $("#project-main").hidden = false;
  render();
}

function renderEditorMedia() {
  const list = $("#detail-media-list");
  list.innerHTML = state.media.length ? state.media.map((item, index) => `
    <div class="detail-media-item ${item.file ? "is-pending" : ""}" data-media-index="${index}">
      ${mediaMarkup(item, item.alt || `媒体 ${index + 1}`)}
      <div class="detail-media-item-info"><strong>${html(item.alt || `媒体 ${index + 1}`)}</strong><span>${item.type === "video" ? "视频" : "图片"}${item.file ? " · 待上传" : ""}</span></div>
      <button class="icon-button danger-button" type="button" data-media-remove="${index}" aria-label="删除媒体" title="删除媒体"><i data-lucide="trash-2"></i></button>
    </div>`).join("") : `<div class="detail-media-empty">还没有媒体，请添加图片或视频</div>`;
  refreshIcons();
}

function openEditor() {
  $("#detail-title-input").value = state.project.title;
  $("#detail-category-input").value = state.project.category;
  $("#detail-description-input").value = state.project.description;
  $("#detail-body-input").value = state.project.detail || state.project.description;
  $("#detail-token").value = sessionStorage.getItem("portfolioGithubToken") || "";
  state.media = normalizeMedia(state.project);
  state.pendingMedia = [];
  renderEditorMedia();
  $("#detail-editor").hidden = false;
  document.body.classList.add("editor-open");
  $("#detail-title-input").focus();
}

function closeEditor() { $("#detail-editor").hidden = true; document.body.classList.remove("editor-open"); }

function fileExtension(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "ogg", "mov"].includes(extension) ? extension : ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogg", "video/quicktime": "mov" }[file.type] || "bin");
}
function fileMediaType(file) { return file.type.startsWith("video/") ? "video" : "image"; }

async function githubRequest(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...options, headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...options.headers } });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error("访问令牌无效或已失效");
    if (response.status === 403) throw new Error("访问令牌没有写入该仓库的权限");
    throw new Error(detail.message || `GitHub 请求失败 (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}
async function putFile(path, content, token, message) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const apiPath = `/repos/${REPOSITORY.owner}/${REPOSITORY.repo}/contents/${encoded}`;
  const existing = await githubRequest(`${apiPath}?ref=${REPOSITORY.branch}`, token).catch(error => /Not Found/i.test(error.message) ? null : Promise.reject(error));
  return githubRequest(apiPath, token, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, content, branch: REPOSITORY.branch, ...(existing?.sha ? { sha: existing.sha } : {}) }) });
}

async function save() {
  const token = $("#detail-token").value.trim();
  const status = $("#detail-status");
  const button = $("#detail-save");
  if (!token) { status.textContent = "请输入访问令牌"; status.className = "save-status is-error"; $("#detail-token").focus(); return; }
  const updated = { ...state.project, title: $("#detail-title-input").value.trim(), category: $("#detail-category-input").value.trim(), description: $("#detail-description-input").value.trim(), detail: $("#detail-body-input").value.trim() };
  if (!updated.title || !updated.description) { status.textContent = "项目名称和简介不能为空"; status.className = "save-status is-error"; return; }
  if (!state.media.length) { status.textContent = "请至少保留一项图片或视频"; status.className = "save-status is-error"; return; }
  button.disabled = true;
  try {
    sessionStorage.setItem("portfolioGithubToken", token);
    const user = await githubRequest("/user", token);
    status.textContent = `已验证 ${user.login}`;
    const savedMedia = [];
    for (let index = 0; index < state.media.length; index += 1) {
      const item = state.media[index];
      if (!item.file) { savedMedia.push({ type: item.type, src: item.src, alt: item.alt || updated.title }); continue; }
      status.textContent = `正在上传媒体 ${index + 1}/${state.media.length}`;
      const path = `assets/uploads/${Date.now()}-project-${projectIndex}-${index}.${fileExtension(item.file)}`;
      const bytes = new Uint8Array(await item.file.arrayBuffer());
      await putFile(path, bytesToBase64(bytes), token, `content: upload project ${projectIndex} media ${index}`);
      savedMedia.push({ type: item.type, src: path, alt: item.alt || item.file.name });
    }
    updated.media = savedMedia;
    updated.image = savedMedia.find(item => item.type === "image")?.src || savedMedia[0].src;
    status.textContent = "正在保存项目内容";
    const nextContent = JSON.parse(JSON.stringify(state.content));
    nextContent.projects[projectIndex] = updated;
    const result = await putFile(REPOSITORY.contentPath, textToBase64(`${JSON.stringify(nextContent, null, 2)}\n`), token, `content: update project ${projectIndex} media and detail`);
    state.content = nextContent;
    state.project = nextContent.projects[projectIndex];
    state.media = savedMedia;
    state.pendingMedia = [];
    render();
    closeEditor();
    showToast(`已保存 ${result.commit.sha.slice(0, 7)}，页面正在部署`);
  } catch (error) {
    status.textContent = error.message;
    status.className = "save-status is-error";
  } finally { button.disabled = false; }
}

function showToast(message) { const toast = $("#detail-toast"); toast.textContent = message; toast.classList.add("is-visible"); setTimeout(() => toast.classList.remove("is-visible"), 3400); }

$("#project-edit").addEventListener("click", openEditor);
$("#detail-close").addEventListener("click", closeEditor);
$("#detail-scrim").addEventListener("click", closeEditor);
$("#detail-save").addEventListener("click", save);
$("#detail-image-input").addEventListener("change", event => {
  const files = [...event.target.files];
  const accepted = files.filter(file => (file.type.startsWith("image/") || file.type.startsWith("video/")) && file.size <= 50 * 1024 * 1024);
  if (accepted.length !== files.length) $("#detail-status").textContent = "仅支持图片/视频，单个文件不能超过 50 MB";
  for (const file of accepted) state.media.push({ type: fileMediaType(file), src: URL.createObjectURL(file), alt: file.name, file });
  state.pendingMedia.push(...accepted);
  event.target.value = "";
  renderEditorMedia();
});
$("#detail-media-list").addEventListener("click", event => {
  const button = event.target.closest("[data-media-remove]");
  if (!button) return;
  state.media.splice(Number(button.dataset.mediaRemove), 1);
  renderEditorMedia();
});
document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("#detail-editor").hidden) closeEditor(); });
load().catch(() => showError());
refreshIcons();
