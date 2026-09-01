const REPOSITORY = { owner: "5121737085687ybs-hub", repo: "5121737085687ybs-hub.github.io", branch: "main", contentPath: "data/content.json" };
const query = new URLSearchParams(window.location.search);
const projectIndex = Number(query.get("project"));
const state = { content: null, project: null, upload: null };
const $ = selector => document.querySelector(selector);
const html = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const bytesToBase64 = bytes => { let binary = ""; for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(binary); };
const textToBase64 = value => bytesToBase64(new TextEncoder().encode(value));
const refreshIcons = () => { if (window.lucide) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } }); };

function showError() { $("#project-main").hidden = true; $("#project-error").hidden = false; refreshIcons(); }

function render() {
  const { project, content } = state;
  document.title = `${project.title} - ${content.site.logo}`;
  $("#project-logo").textContent = content.site.logo;
  $("#project-category").textContent = project.category || "PROJECT";
  $("#project-story-category").textContent = project.category || "PROJECT";
  $("#project-number").textContent = `PROJECT / ${String(projectIndex + 1).padStart(2, "0")}`;
  $("#project-title").textContent = project.title;
  $("#project-description").textContent = project.description;
  $("#project-image").src = project.image;
  $("#project-image").alt = project.title;
  $("#project-detail").textContent = project.detail || project.description;
  const previous = content.projects[projectIndex - 1];
  const next = content.projects[projectIndex + 1];
  const previousLink = $("#previous-project");
  const nextLink = $("#next-project");
  previousLink.hidden = !previous;
  nextLink.hidden = !next;
  if (previous) { previousLink.href = `project.html?project=${projectIndex - 1}`; previousLink.querySelector("strong").textContent = previous.title; }
  if (next) { nextLink.href = `project.html?project=${projectIndex + 1}`; nextLink.querySelector("strong").textContent = next.title; }
  refreshIcons();
}

async function load() {
  const response = await fetch(`data/content.json?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("内容文件加载失败");
  state.content = await response.json();
  if (!Number.isInteger(projectIndex) || projectIndex < 0 || projectIndex >= state.content.projects.length) return showError();
  state.project = state.content.projects[projectIndex];
  $("#project-main").hidden = false;
  render();
}

function openEditor() {
  $("#detail-title-input").value = state.project.title;
  $("#detail-category-input").value = state.project.category;
  $("#detail-description-input").value = state.project.description;
  $("#detail-body-input").value = state.project.detail || state.project.description;
  $("#detail-image-preview").src = state.project.image;
  $("#detail-token").value = sessionStorage.getItem("portfolioGithubToken") || "";
  $("#detail-editor").hidden = false;
  document.body.classList.add("editor-open");
  $("#detail-title-input").focus();
}

function closeEditor() { $("#detail-editor").hidden = true; document.body.classList.remove("editor-open"); }

function fileExtension(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(extension) ? extension : ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type] || "jpg");
}

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
  const updated = { title: $("#detail-title-input").value.trim(), category: $("#detail-category-input").value.trim(), description: $("#detail-description-input").value.trim(), detail: $("#detail-body-input").value.trim(), image: state.project.image };
  if (!updated.title || !updated.description) { status.textContent = "项目名称和简介不能为空"; status.className = "save-status is-error"; return; }
  button.disabled = true;
  try {
    sessionStorage.setItem("portfolioGithubToken", token);
    const user = await githubRequest("/user", token);
    status.textContent = `已验证 ${user.login}`;
    if (state.upload) {
      const extension = fileExtension(state.upload);
      const path = `assets/uploads/${Date.now()}-project-${projectIndex}.${extension}`;
      status.textContent = "正在上传项目图片";
      const bytes = new Uint8Array(await state.upload.arrayBuffer());
      await putFile(path, bytesToBase64(bytes), token, `content: upload project ${projectIndex} image`);
      updated.image = path;
    }
    status.textContent = "正在保存项目内容";
    const nextContent = JSON.parse(JSON.stringify(state.content));
    nextContent.projects[projectIndex] = updated;
    const result = await putFile(REPOSITORY.contentPath, textToBase64(`${JSON.stringify(nextContent, null, 2)}\n`), token, `content: update project ${projectIndex} from detail page`);
    state.content = nextContent;
    state.project = nextContent.projects[projectIndex];
    state.upload = null;
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
$("#detail-image-input").addEventListener("change", event => { const file = event.target.files[0]; if (!file) return; if (file.size > 8 * 1024 * 1024) { $("#detail-status").textContent = "单张图片不能超过 8 MB"; return; } state.upload = file; $("#detail-image-preview").src = URL.createObjectURL(file); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("#detail-editor").hidden) closeEditor(); });
load().catch(() => showError());
refreshIcons();
