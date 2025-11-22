let apiUsers = [];
let realTasks = {};
let realProjects = {};
let chatMessages = {};
let userAcceptanceData = { acceptances: [] };
let activeChatProjectId = null;
let currentFilteredUserId = null;
window.userStatsCache = {};
window.departments = [];

document.addEventListener("DOMContentLoaded", function () {
  initializeSelect2();
  initializeDataFromServer();
  loadAcceptanceDataFromDatabase();
  initializeFiltering();
  initializeChatEvents();
  refreshAllProjectsUI();
  filterContent();
  updateSummaryCards();
});

// SELECT2
function initializeSelect2() {
  if (window.$ && $.fn.select2) {
    $("#Department").select2({
      placeholder: "Select Department",
      allowClear: true,
      width: "200px",
    });
    $("#userFilter").select2({
      placeholder: "Select User",
      allowClear: true,
      width: "200px",
    });
    $("#Department, #userFilter").on("change", filterContent);
  }
}

// LOAD SERVER DATA
function initializeDataFromServer() {
  if (window.serverData) {
    realTasks = window.serverData.realTasks || {};
    realProjects = window.serverData.realProjects || {};
    chatMessages = window.serverData.chatMessages || {};

    // normalise project status
    Object.keys(realProjects).forEach((pid) => {
      const p = realProjects[pid];
      if (p.status === "Complete") p.status = "Completed";
      p.status = p.status || "Pending";
    });

    // users
    const su = window.serverData.apiUsers || [];
    apiUsers = su.map((u) => ({
      id: (u.bioid || u.id || u.BioId || generateUserId()).toString(),
      name: u.userName || u.name || u.Name || "Unknown User",
      email: u.email || u.Email || "",
      department: u.department || u.Department || "",
    }));

    // acceptances
    if (
      window.serverData.dbAcceptances &&
      Array.isArray(window.serverData.dbAcceptances)
    ) {
      userAcceptanceData.acceptances = window.serverData.dbAcceptances.map(
        (a) => ({
          id: a.id,
          projectId: parseInt(a.projectId),
          projectName: a.projectName,
          userId: a.userId?.toString(),
          userName: a.userName,
          status: a.status,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })
      );
    }

    // tasks
    if (
      window.serverData.allTasks &&
      Array.isArray(window.serverData.allTasks)
    ) {
      processTaskData(window.serverData.allTasks);
    } else if (
      window.serverData.tasks &&
      Array.isArray(window.serverData.tasks)
    ) {
      processTaskData(window.serverData.tasks);
    }

    // completed projects → all tasks completed
    Object.keys(realProjects).forEach((pid) => {
      if (realProjects[pid].status === "Completed") {
        (realTasks[pid] || []).forEach((t) => (t.status = "Completed"));
      }
    });

    if (window.serverData.departments)
      window.departments = window.serverData.departments;
  }

  if (apiUsers.length) {
    updateUserAcceptanceData();
    populateUserDropdown();
    populateUserCards();
  } else {
    loadUsersFromApi();
  }
  loadDepartmentsFromApi();
}

// TASK PROCESSING
function processTaskData(tasks) {
  realTasks = {};
  tasks.forEach((t) => {
    const id = t.id || t.Id || t.ID || generateTaskId();
    const name = t.name || t.Name || t.TaskName || "Unnamed Task";
    const desc =
      t.description || t.Description || t.TaskDescription || "No description";
    let status = (
      t.status ||
      t.Status ||
      t.TaskStatus ||
      "Pending"
    ).toLowerCase();
    if (["complete", "completed"].includes(status)) status = "Completed";
    else if (status === "in progress") status = "In Progress";
    else status = "Pending";

    const due = t.dueDate || t.DueDate || t.TaskDueDate || new Date();
    const ass =
      t.assignedUsers || t.AssignedUsers || t.AssignedTo || "Unassigned";
    const pid = t.projectId || t.ProjectId || findProjectIdByTask(t);

    if (pid && !realTasks[pid]) realTasks[pid] = [];
    if (pid) {
      realTasks[pid].push({
        id,
        name,
        description: desc,
        status,
        dueDate: new Date(due),
        assignedUsers: ass,
      });
    }
  });
}

function findProjectIdByTask(t) {
  const pn = t.projectName || t.ProjectName;
  if (pn) {
    const p = Object.values(realProjects).find(
      (p) => p.name === pn || p.Name === pn
    );
    return p ? p.id : null;
  }
  return null;
}

// DEPARTMENTS
async function loadDepartmentsFromApi() {
  if (window.serverData?.departments?.length) {
    window.departments = window.serverData.departments;
  } else {
    const sel = document.getElementById("Department");
    if (sel) {
      window.departments = Array.from(sel.options)
        .slice(1)
        .map((o) => o.value)
        .filter((v) => v);
    }
  }
  populateDepartmentFilter();
  updateDepartmentWiseSummaries();
}

function populateDepartmentFilter() {
  const sel = document.getElementById("Department");
  if (!sel || !window.departments.length) return;
  if (sel.options.length === 2) {
    window.departments.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = d;
      sel.appendChild(opt);
    });
  }
  if (window.$?.fn.select2) $("#Department").trigger("change.select2");
}

// ACCEPTANCE DATA FROM DB
async function loadAcceptanceDataFromDatabase() {
  try {
    const r = await fetch("/ProjectAcceptance/GetAllAcceptances", {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const res = await r.json();

    let data = [];
    if (res.success && res.data) {
      if (Array.isArray(res.data)) data = res.data;
      else if (res.data.$values && Array.isArray(res.data.$values))
        data = res.data.$values;
    }

    userAcceptanceData.acceptances = data.map((a) => ({
      id: a.id,
      projectId: parseInt(a.projectId),
      projectName: a.projectName,
      userId: a.userId?.toString(),
      userName: a.userName,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    updateAllProjectAcceptanceStatus();
    updateUserCardsAcceptanceStatus();
    updateAllCounts();
    updateSummaryCards();
  } catch (e) {
    console.warn("Acceptances load error:", e);
    userAcceptanceData.acceptances = [];
  }
}

// SUMMARY CARDS UPDATE
function updateSummaryCards() {
  // Count only active users (users assigned to projects)
  const activeUsers = new Set();
  Object.values(realProjects).forEach((project) => {
    if (project.assignedUsers) {
      project.assignedUsers
        .split(",")
        .map((user) => user.trim())
        .forEach((user) => {
          if (user) activeUsers.add(user);
        });
    }
  });
  const totalActiveUsers = activeUsers.size;

  // Total projects count
  const totalProjects = Object.keys(realProjects).length;

  let completedProjects = 0;
  let pendingProjects = 0;

  Object.values(realProjects).forEach((project) => {
    if (project.status === "Completed" || isProjectFullyCompleted(project.id)) {
      completedProjects++;
    } else {
      pendingProjects++;
    }
  });

  document.querySelector('[data-summary="total"]').textContent =
    totalActiveUsers;
  document.querySelector('[data-summary="completed"]').textContent =
    completedProjects;
  document.querySelector('[data-summary="inprogress"]').textContent =
    totalProjects;
  document.querySelector('[data-summary="pending"]').textContent =
    pendingProjects;
}

// HELPERS – acceptance / task counts
function getProjectAcceptanceCount(pid) {
  return userAcceptanceData.acceptances.filter(
    (a) => a.projectId == pid && a.status === "Y"
  ).length;
}

function getProjectCompletedTaskCount(pid) {
  const tasks = realTasks[pid] || [];
  console.log("realTasks : ", realTasks);
  console.log("tasks : ", tasks);
  console.log("Task Completed Count : ",  tasks.status == "Complete" ? t.status.length() : 0);

  return tasks.filter((t) => t.status == "Complete").length;
}

function getProjectTotalTaskCount(pid) {
  return (realTasks[pid] || []).length;
}

function isProjectFullyCompleted(pid) {
  const totalTasks = getProjectTotalTaskCount(pid);
  const completedTasks = getProjectCompletedTaskCount(pid);
  return totalTasks > 0 && completedTasks === totalTasks;
}

function getAcceptanceStatus(pid, uid) {
  const rec = userAcceptanceData.acceptances.find(
    (a) => a.projectId === parseInt(pid) && a.userId === uid.toString()
  );
  return rec?.status === "Y" ? "Accepted" : "Pending";
}

// ALL ACCEPTANCES MODAL
function showAllAcceptances() {
  const title = document.getElementById("allAcceptancesTitle");
  const content = document.getElementById("allAcceptancesContent");
  if (!title || !content) return;

  title.textContent = "All Project Acceptances Overview";

  const allRecords = getAllAcceptanceRecords();
  window.allRecordsData = allRecords;

  const total = allRecords.length;
  const completed = allRecords.filter((r) => r.status === "Completed").length;
  const inProgress = allRecords.filter(
    (r) => r.status === "In Progress"
  ).length;
  const pending = allRecords.filter((r) => r.status === "Pending").length;

  let html = `
        <div class="all-records-container">
            <div class="records-filter">
                <select id="departmentFilterModal" class="form-select select2" style="max-width:200px;">
                    <option value="">All Departments</option>
                </select>
                <button class="record-filter-btn active" onclick="filterAllRecords('all',this)">
                    <div class="filter-btn-content"><div class="filter-count">${total}</div>
                    <div class="filter-label"><i class="bi bi-grid-3x3-gap"></i> All Records</div></div>
                </button>
                <button class="record-filter-btn" onclick="filterAllRecords('inprogress',this)">
                    <div class="filter-btn-content"><div class="filter-count">${inProgress}</div>
                    <div class="filter-label"><i class="bi bi-play-circle"></i> In Progress</div></div>
                </button>
                <button class="record-filter-btn" onclick="filterAllRecords('pending',this)">
                    <div class="filter-btn-content"><div class="filter-count">${pending}</div>
                    <div class="filter-label"><i class="bi bi-clock"></i> Pending</div></div>
                </button>
                <button class="record-filter-btn" onclick="filterAllRecords('completed',this)">
                    <div class="filter-btn-content"><div class="filter-count">${completed}</div>
                    <div class="filter-label"><i class="bi bi-check-circle"></i> Completed</div></div>
                </button>
            </div>
            <div id="allRecordsContainer">
    `;

  if (!allRecords.length) {
    html += `<div class="empty-state text-center py-5">
                    <i class="bi bi-person-check" style="font-size:3rem;"></i>
                    <p class="mt-3">No acceptance records found.</p>
                    <p class="text-muted">Acceptance records will appear here when users accept Works.</p>
                 </div>`;
  } else {
    const sorted = [...allRecords].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return db - da;
    });
alert(123);
    console.log("sorted : ", sorted);

    html += `<div class="records-grid" id="allRecordsGrid">`;
    sorted.forEach((r) => {
      const statusCls =
        r.status === "Completed"
          ? "bg-success"
          : r.status === "In Progress"
          ? "bg-info"
          : "bg-warning";
      const icon =
        r.status === "Completed"
          ? "check-circle"
          : r.status === "In Progress"
          ? "play-circle"
          : "clock";

      html += `
                <div class="record-card"
                     data-status="${r.status.toLowerCase().replace(" ", "")}"
                     data-department="${r.department}"
                     data-user-id="${r.userId}"
                     data-project-id="${r.projectId}">
                    <div class="record-header">
                        <div class="record-project-name">${sanitizeHTML(
                          r.projectName
                        )}</div>
                        <span class="badge ${statusCls}">
                            <i class="bi bi-${icon}"></i> ${r.status}
                        </span>
                    </div>
                    <div class="record-details">
                        <div><strong>Assigned User:</strong> ${sanitizeHTML(
                          r.userName
                        )}</div>
                        <div><strong>User ID:</strong> ${r.userId}</div>
                        <div><strong>Department:</strong> ${sanitizeHTML(
                          r.department
                        )}</div>
                        <div><strong>Status:</strong> ${r.status}</div>
                        <div><strong>Project ID:</strong> ${r.projectId}</div>
                        <div><strong>Tasks:</strong> ${r.completedTasks}/${
        r.totalTasks
      } Completed</div>
                    </div>
                    <div class="record-footer">
                        <span>${
                          r.createdAt
                            ? "Accepted: " +
                              new Date(r.createdAt).toLocaleDateString()
                            : "Pending Acceptance"
                        }</span>
                        <div class="record-actions">
                            <button class="btn btn-sm btn-outline-primary"
                                    onclick="event.stopPropagation(); viewUserProjects('${
                                      r.userId
                                    }','${r.userName.replace(/'/g, "\\'")}')"
                                    title="View User's Projects">
                                <i class="bi bi-person"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
    });
    html += `</div>`;
  }
  html += `</div></div>`;
  content.innerHTML = html;

  const deptSel = document.getElementById("departmentFilterModal");
  if (deptSel && window.departments.length) {
    deptSel.innerHTML = '<option value="">All Departments</option>';
    window.departments.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = d;
      deptSel.appendChild(opt);
    });
    deptSel.addEventListener("change", () => {
      const activeBtn = document.querySelector(".record-filter-btn.active");
      const type =
        activeBtn?.getAttribute("onclick")?.match(/'([^']+)'/)?.[1] || "all";
      updateFilterButtonCounts(deptSel.value);
      filterAllRecords(type, activeBtn, deptSel.value);
    });
  }

  new bootstrap.Modal(document.getElementById("allAcceptancesModal")).show();
}

// ALL ACCEPTANCE RECORDS (for modal) - UPDATED: Show incremental task completion
function getAllAcceptanceRecords() {
  const out = [];

  userAcceptanceData.acceptances.forEach((acc) => {
    const proj = realProjects[acc.projectId];
    const completedTasks = getProjectCompletedTaskCount(acc.projectId);
    const totalTasks = getProjectTotalTaskCount(acc.projectId);

    // Determine status based on task completion
    let dispStatus = "Pending";
    if (isProjectFullyCompleted(acc.projectId)) {
      dispStatus = "Completed";
    } else if (acc.status === "Y") {
      dispStatus = "In Progress";
    }

    out.push({
      type: "acceptance",
      id: acc.id,
      userName: acc.userName,
      userId: acc.userId,
      projectName: acc.projectName,
      projectId: acc.projectId,
      status: dispStatus,
      department: proj ? proj.department : "",
      completedTasks: completedTasks,
      totalTasks: totalTasks,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    });
  });

  Object.values(realProjects).forEach((p) => {
    if (getProjectAcceptanceCount(p.id) === 0) {
      const completedTasks = getProjectCompletedTaskCount(p.id);
      const totalTasks = getProjectTotalTaskCount(p.id);
      out.push({
        type: "pending-project",
        id: `pending-${p.id}`,
        userName: "No users accepted yet",
        userId: "N/A",
        projectName: p.name,
        projectId: p.id,
        status: "Pending",
        department: p.department || "",
        completedTasks: completedTasks,
        totalTasks: totalTasks,
        createdAt: null,
        updatedAt: null,
      });
    }
  });
  return out;
}

// FILTER BUTTON COUNTS (modal)
function updateFilterButtonCounts(dept = "") {
  const rec = getAllAcceptanceRecords();
  const filtered = dept ? rec.filter((r) => r.department === dept) : rec;
  const total = filtered.length;
  const comp = filtered.filter((r) => r.status === "Completed").length;
  const prog = filtered.filter((r) => r.status === "In Progress").length;
  const pend = filtered.filter((r) => r.status === "Pending").length;

  document
    .querySelector('.record-filter-btn[onclick*="all"]')
    ?.querySelector(".filter-count")
    ?.replaceWith(document.createTextNode(total));
  document
    .querySelector('.record-filter-btn[onclick*="inprogress"]')
    ?.querySelector(".filter-count")
    ?.replaceWith(document.createTextNode(prog));
  document
    .querySelector('.record-filter-btn[onclick*="pending"]')
    ?.querySelector(".filter-count")
    ?.replaceWith(document.createTextNode(pend));
  document
    .querySelector('.record-filter-btn[onclick*="completed"]')
    ?.querySelector(".filter-count")
    ?.replaceWith(document.createTextNode(comp));
}

// FILTER RECORDS INSIDE MODAL
async function filterAllRecords(type, btn, dept = "") {
  document
    .querySelectorAll(".record-filter-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  const grid = document.getElementById("allRecordsGrid");
  if (!grid) return;

  const cards = grid.querySelectorAll(".record-card");
  let visible = 0;
  cards.forEach((c) => {
    const st = c.dataset.status;
    const dp = c.dataset.department;
    const show = (type === "all" || st === type) && (!dept || dp === dept);
    c.style.display = show ? "block" : "none";
    if (show) visible++;
  });

  const msg = grid.parentNode.querySelector(".no-records-message");
  if (visible === 0) {
    if (!msg) {
      const el = document.createElement("div");
      el.className = "empty-state text-center py-5 no-records-message";
      el.innerHTML = `<p class="mt-3">No ${type} records found</p>`;
      grid.parentNode.appendChild(el);
    }
  } else if (msg) msg.remove();
}

// VIEW USER PROJECTS FROM MODAL
function viewUserProjects(uid, uname) {
  bootstrap.Modal.getInstance(
    document.getElementById("allAcceptancesModal")
  ).hide();
  filterProjectsByUser(uid, uname);
  showToast(`Showing projects for ${uname}`, "info");
}

// USER STATS
function getUserProjects(uname) {
  const out = [];
  Object.values(realProjects).forEach((p) => {
    const ass = (p.assignedUsers || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    if (ass.includes(uname))
      out.push({ id: p.id, name: p.name, status: p.status });
  });
  return out;
}

function getUserCompletedProjectsCount(uid) {
  const u = apiUsers.find((x) => x.id === uid);
  if (!u) return 0;
  const projs = getUserProjects(u.name);
  return projs.filter(
    (p) =>
      realProjects[p.id]?.status === "Completed" ||
      isProjectFullyCompleted(p.id)
  ).length;
}

function getUserInProgressProjectsCount(uid) {
  const u = apiUsers.find((x) => x.id === uid);
  if (!u) return 0;
  const projs = getUserProjects(u.name);
  return projs.filter(
    (p) =>
      realProjects[p.id]?.status === "Active" &&
      getAcceptanceStatus(p.id, uid) === "Accepted" &&
      !isProjectFullyCompleted(p.id)
  ).length;
}

function getUserPendingProjectsCount(uid) {
  const u = apiUsers.find((x) => x.id === uid);
  if (!u) return 0;
  const projs = getUserProjects(u.name);
  return projs.filter((p) => getAcceptanceStatus(p.id, uid) === "Pending")
    .length;
}

function calculateUserStats(uid) {
  if (window.userStatsCache[uid]) return window.userStatsCache[uid];
  const s = {
    completedCount: getUserCompletedProjectsCount(uid),
    inProgressCount: getUserInProgressProjectsCount(uid),
    pendingCount: getUserPendingProjectsCount(uid),
  };
  window.userStatsCache[uid] = s;
  return s;
}

// HTML SANITIZE
function sanitizeHTML(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// PROJECT ACCEPTANCE BADGE (per card)
function updateProjectAcceptanceStatus(pid) {
  const card = document.querySelector(`[data-project-id="${pid}"]`);
  if (!card) return;
  const p = realProjects[pid];
  if (!p?.assignedUsers) return;

  const all = p.assignedUsers
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s);
  let accepted = 0;
  all.forEach((name) => {
    const u = apiUsers.find((x) => x.name === name);
    if (u && getAcceptanceStatus(pid, u.id) === "Accepted") accepted++;
  });

  const fully = accepted === all.length && all.length;

  card.querySelectorAll(".assignee-avatar").forEach((av) => {
    const name = av.dataset.userName;
    const u = apiUsers.find((x) => x.name === name);
    av.style.background =
      u && getAcceptanceStatus(pid, u.id) === "Accepted"
        ? "linear-gradient(135deg, #28a745, #20c997)"
        : "linear-gradient(135deg, #2a5298, #1e3c72)";
  });

  const badge = card.querySelector(".acceptance-badge");
  if (badge) {
    let txt, cls, ic;
    if (p.status === "Completed") {
      cls = "completed";
      ic = "bi bi-check-circle";
      txt = `Completed (${accepted}/${all.length})`;
    } else if (fully) {
      cls = "inprogress";
      ic = "bi bi-check";
      txt = `In Progress (${accepted}/${all.length})`;
    } else {
      cls = "pending";
      ic = "bi bi-clock";
      txt = `Pending (${all.length})`;
    }
    badge.className = `acceptance-badge ${cls}`;
    badge.innerHTML = `<i class="${ic}"></i> ${txt}`;
  }
}

function updateAllProjectAcceptanceStatus() {
  Object.keys(realProjects).forEach(updateProjectAcceptanceStatus);
}

// PROJECT CARD UI REFRESH - WITH TASK COUNT AND PROGRESS BAR - UPDATED: Show incremental task completion
let isUpdatingProject = false;
function refreshProjectCardUI(pid) {
  if (isUpdatingProject) return;
  isUpdatingProject = true;
  try {
    const p = realProjects[pid];
    const card = document.querySelector(
      `.project-card[data-project-id="${pid}"]`
    );
    if (!p || !card) return;

    // Get current task counts
    const totalTasks = getProjectTotalTaskCount(pid);
    const completedTasks = getProjectCompletedTaskCount(pid);
    const progressPercentage =
      totalTasks > 0 ? Math.round((completedTasks * 100) / totalTasks) : 0;

    console.log(
      `Project ${pid}: ${completedTasks}/${totalTasks} tasks completed (${progressPercentage}%)`
    );

    // Update task count display - SHOW INCREMENTAL COUNT (1/4, 2/4, 3/4, 4/4)
    const taskText = card.querySelector(".project-tasks");
    if (taskText) {
      if (isProjectFullyCompleted(pid)) {
        taskText.innerHTML = `<i class="bi bi-check-circle"></i> ${completedTasks}/${totalTasks} Tasks Completed`;
        taskText.style.color = "#28a745";
        taskText.style.fontWeight = "bold";
      } else {
        taskText.innerHTML = `<i class="bi bi-list-task"></i> ${completedTasks}/${totalTasks} Tasks`;
        taskText.style.color = progressPercentage === 100 ? "#28a745" : "";
        taskText.style.fontWeight = "normal";
      }
    }

    // Update progress bar
    const progressBar = card.querySelector(".progress-bar-fill");
    if (progressBar) {
      progressBar.style.width = `${progressPercentage}%`;
      progressBar.style.background =
        progressPercentage === 100
          ? "linear-gradient(135deg, #28a745, #20c997)"
          : progressPercentage > 50
          ? "linear-gradient(135deg, #ffc107, #fd7e14)"
          : "linear-gradient(135deg, #2a5298, #1e3c72)";
    }

    // Update progress label
    const progressLabel = card.querySelector(".progress-label span:last-child");
    if (progressLabel) {
      progressLabel.textContent = `${progressPercentage}%`;
    }

    // Update status badge - ONLY SHOW "COMPLETED" WHEN ALL TASKS DONE
    const statusBadge = card.querySelector(".project-status-badge");
    if (statusBadge) {
      if (isProjectFullyCompleted(pid)) {
        statusBadge.textContent = "Completed";
        statusBadge.className = `project-status-badge status-completed`;
      } else {
        const status = p.status || "Pending";
        statusBadge.textContent = status;
        statusBadge.className = `project-status-badge status-${status
          .toLowerCase()
          .replace(" ", "")}`;
      }
    }

    updateProjectAcceptanceStatus(pid);
    updateProjectCompletionStatus(pid);
    updateUserCardsAcceptanceStatus();
    updateSummaryCards();

    if (
      document.getElementById("allAcceptancesModal")?.classList.contains("show")
    ) {
      setTimeout(showAllAcceptances, 150);
    }

    updateAllCounts();
  } finally {
    isUpdatingProject = false;
  }
}

function refreshAllProjectsUI() {
  Object.keys(realProjects).forEach(refreshProjectCardUI);
}

// PROJECT COMPLETION STATUS - UPDATED: Auto-update project status when all tasks are completed
function updateProjectCompletionStatus(pid) {
  if (isUpdatingProject) return;
  const p = realProjects[pid];
  if (!p) return;

  const isFullyCompleted = isProjectFullyCompleted(pid);

  if (isFullyCompleted) {
    if (p.status !== "Completed") {
      p.status = "Completed";
      const card = document.querySelector(
        `.project-card[data-project-id="${pid}"]`
      );
      if (card) {
        const statusBadge = card.querySelector(".project-status-badge");
        if (statusBadge) {
          statusBadge.innerHTML = `<i class="bi bi-check-circle"></i> Completed`;
          statusBadge.className = "project-status-badge status-completed";
        }
        const acceptanceBadge = card.querySelector(".acceptance-badge");
        if (acceptanceBadge) {
          acceptanceBadge.className = "acceptance-badge completed";
          acceptanceBadge.innerHTML = `<i class="bi bi-check-circle"></i> Completed`;
        }
      }
      updateUserCardsAcceptanceStatus();
      updateAllCounts();
      updateSummaryCards();
      if (
        document
          .getElementById("allAcceptancesModal")
          ?.classList.contains("show")
      ) {
        setTimeout(showAllAcceptances, 150);
      }
      showToast(`Project "${p.name}" marked as Completed.`, "success");
    }
  } else if (p.status === "Completed") {
    p.status = "Active";
    refreshProjectCardUI(pid);
  }
}

// USER CARDS (only users that belong to visible projects)
function updateUserCardsAcceptanceStatus() {
  window.userStatsCache = {};
  document.querySelectorAll(".user-card").forEach((c) => {
    const uid = c.dataset.userId;
    const stats = calculateUserStats(uid);
    const statusElement = c.querySelector(".user-acceptance-status");
    if (statusElement) {
      statusElement.innerHTML = `<span class="user-completed">${stats.completedCount} completed</span> •
                           <span class="user-inprogress">${stats.inProgressCount} in progress</span> •
                           <span class="user-pending">${stats.pendingCount} pending</span>`;
    }
    const notificationBadge = c.querySelector(".notification-badge");

    if (stats.pendingCount) {
      if (!notificationBadge) {
        const badge = document.createElement("div");
        badge.className = "notification-badge";
        badge.textContent = stats.pendingCount;
        c.appendChild(badge);
      } else notificationBadge.textContent = stats.pendingCount;
      c.classList.add("has-notification");
    } else {
      if (notificationBadge) notificationBadge.remove();
      c.classList.remove("has-notification");
    }
  });
  updateUserCounts();
}

// USER API / LOCAL FALLBACK
async function loadUsersFromApi() {
  try {
    showLoading("Loading users...");
    const urls = [
      "/api/users",
      "/api/User",
      "/User/GetAllUsers",
      "/Account/GetAllUsers",
    ];
    let response = null;
    for (const url of urls) {
      try {
        response = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        if (response.ok) break;
      } catch {}
    }
    if (!response?.ok) throw new Error("No API");
    const data = await response.json();
    if (Array.isArray(data)) {
      apiUsers = data.map((u) => ({
        id: (u.bioid || u.id || u.BioId || generateUserId()).toString(),
        name: u.userName || u.name || u.Name || "Unknown User",
        email: u.email || u.Email || "",
        department: u.department || u.Department || "",
      }));
      populateUserDropdown();
      updateUserAcceptanceData();
      populateUserCards();
      updateSummaryCards();
    }
  } catch (e) {
    console.warn("API users failed → local", e);
    loadLocalUsers();
  } finally {
    hideLoading();
  }
}

function loadLocalUsers() {
  if (!apiUsers.length) {
    apiUsers = window.serverData?.apiUsers || [
      { id: "1", name: "Default User", department: "" },
    ];
  }
  updateUserAcceptanceData();
  populateUserDropdown();
  populateUserCards();
  updateSummaryCards();
}

function generateUserId() {
  return "user-" + Math.random().toString(36).substr(2, 9);
}

function populateUserDropdown() {
  const select = document.getElementById("userFilter");
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  apiUsers.forEach((u) => {
    const option = document.createElement("option");
    option.value = u.id;
    option.textContent = u.name;
    select.appendChild(option);
  });
  if (window.$?.fn.select2) $("#userFilter").trigger("change.select2");
}

// POPULATE USER CARDS – ONLY VISIBLE PROJECTS
function populateUserCards() {
  const usersList = document.getElementById("usersList");
  if (!usersList) return;

  const visibleProjects = Array.from(
    document.querySelectorAll(".project-card")
  ).filter(
    (card) =>
      card.style.display !== "none" && !card.classList.contains("d-none")
  );

  const assignedUserNames = new Set();
  visibleProjects.forEach((project) =>
    project.querySelectorAll(".assignee-avatar").forEach((avatar) => {
      const userName = avatar.dataset.userName;
      if (userName) assignedUserNames.add(userName);
    })
  );

  const visibleUsers = apiUsers.filter((u) => assignedUserNames.has(u.name));

  if (!visibleUsers.length) {
    usersList.innerHTML = `
            <div class="empty-state text-center py-5">
                <i class="bi bi-people display-4 text-muted d-block mb-3"></i>
                <p class="text-muted fw-semibold">No users assigned to visible projects</p>
                <small class="text-muted">
                    ${
                      currentFilteredUserId
                        ? "Select another user"
                        : document.getElementById("Department")?.value
                        ? "Try another department"
                        : document.getElementById("projectSearch")?.value
                        ? "Try different search"
                        : "Assign users to projects"
                    }
                </small>
            </div>`;
    updateUserCounts();
    return;
  }

  usersList.innerHTML = "";
  visibleUsers.forEach((user) => {
    const stats = calculateUserStats(user.id);
    const userCard = document.createElement("div");
    userCard.className = `user-card ${
      stats.pendingCount ? "has-notification" : ""
    }`;
    userCard.dataset.userId = user.id;
    userCard.dataset.userName = user.name;
    userCard.dataset.userDepartment = user.department;
    userCard.onclick = () => filterProjectsByUser(user.id, user.name);
    userCard.innerHTML = `
            <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <div class="user-name">${sanitizeHTML(user.name)}</div>
                <div class="user-bioid">${user.id}</div>
                <div class="user-acceptance-status">
                    <span class="user-completed">${
                      stats.completedCount
                    } completed</span> •
                    <span class="user-inprogress">${
                      stats.inProgressCount
                    } in progress</span> •
                    <span class="user-pending">${
                      stats.pendingCount
                    } pending</span>
                </div>
            </div>
            ${
              stats.pendingCount
                ? `<div class="notification-badge">${stats.pendingCount}</div>`
                : ""
            }
        `;
    usersList.appendChild(userCard);
  });
  updateUserCounts();
}

// LOADING / COUNTS / TOAST
function showLoading(message = "Loading...") {
  let loadingElement = document.getElementById("loadingIndicator");
  if (!loadingElement) {
    loadingElement = document.createElement("div");
    loadingElement.id = "loadingIndicator";
    loadingElement.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;z-index:9999;backdrop-filter:blur(5px);font-size:1.1rem;";
    document.body.appendChild(loadingElement);
  }
  loadingElement.innerHTML = `<div class="text-center"><div class="spinner-border text-light" style="width:3rem;height:3rem;"></div><div class="mt-3">${message}</div></div>`;
}

function hideLoading() {
  const loadingElement = document.getElementById("loadingIndicator");
  if (loadingElement) loadingElement.remove();
}

function updateAllCounts() {
  updateUserCounts();
  updateProjectCounts();
  updateDepartmentWiseSummaries();
  updateSummaryCards();
}

function updateUserCounts() {
  const userCountElement = document.getElementById("totalUsersCount");
  if (!userCountElement) return;
  const visibleUsers = document.querySelectorAll(
    '.user-card:not([style*="display: none"])'
  ).length;
  const totalUsers = document.querySelectorAll(".user-card").length;
  userCountElement.textContent =
    visibleUsers === totalUsers
      ? `${totalUsers} user${totalUsers !== 1 ? "s" : ""}`
      : `${visibleUsers}/${totalUsers} user${visibleUsers !== 1 ? "s" : ""}`;
}

function updateProjectCounts() {
  const projectCountElement = document.getElementById("totalProjectsCount");
  if (!projectCountElement) return;
  const visibleProjects = document.querySelectorAll(
    '.project-card:not([style*="display: none"])'
  ).length;
  const totalProjects = document.querySelectorAll(".project-card").length;
  projectCountElement.textContent =
    visibleProjects === totalProjects
      ? `${totalProjects} Project${totalProjects !== 1 ? "s" : ""}`
      : `${visibleProjects}/${totalProjects} Project${
          visibleProjects !== 1 ? "s" : ""
        }`;
}

async function updateDepartmentWiseSummaries(department = "") {
  const summaryContainer = document.getElementById("dashboardSummaryCards");
  if (!summaryContainer) return;
  const projectCards = Array.from(document.querySelectorAll(".project-card"));
  const filteredCards = department
    ? projectCards.filter(
        (card) => card.dataset.projectDepartment === department
      )
    : projectCards;

  const total = filteredCards.length;
  const completed = filteredCards.filter(
    (card) =>
      card.dataset.projectStatus === "Completed" ||
      isProjectFullyCompleted(card.dataset.projectId)
  ).length;
  const inProgress = filteredCards.filter((card) => {
    const projectId = card.dataset.projectId;
    return (
      card.dataset.projectStatus === "Active" &&
      getProjectAcceptanceCount(projectId) > 0 &&
      !isProjectFullyCompleted(projectId)
    );
  }).length;
  const pending = filteredCards.filter((card) => {
    const projectId = card.dataset.projectId;
    return (
      card.dataset.projectStatus === "Pending" ||
      (card.dataset.projectStatus === "Active" &&
        getProjectAcceptanceCount(projectId) === 0)
    );
  }).length;

  ["total", "completed", "inprogress", "pending"].forEach((type, index) => {
    const count = [total, completed, inProgress, pending][index];
    const element = summaryContainer.querySelector(
      `[data-summary="${type}"] .summary-count`
    );
    if (element) element.textContent = count;
  });
}

// FILTERING (department / user / search)
function filterProjectsByUser(userId, userName) {
  document
    .querySelectorAll(".user-card")
    .forEach((card) => card.classList.remove("user-active"));
  const userCard = document.querySelector(`[data-user-id="${userId}"]`);
  if (userCard) userCard.classList.add("user-active");

  currentFilteredUserId = userId;
  const filterStatusElement = document.getElementById("filterStatus");
  if (filterStatusElement)
    filterStatusElement.textContent = `Showing projects for: ${sanitizeHTML(
      userName
    )}`;

  document.querySelectorAll(".project-card").forEach((projectCard) => {
    let hasUser = false;
    projectCard.querySelectorAll(".assignee-avatar").forEach((avatar) => {
      const avatarUserName = avatar.dataset.userName;
      const user = apiUsers.find((u) => u.name === avatarUserName);
      if (user && user.id === userId) hasUser = true;
    });
    projectCard.style.display = hasUser ? "" : "none";
  });

  populateUserCards();
  updateAllCounts();
  updateSummaryCards();
}

function initializeFiltering() {
  const departmentSelect = document.getElementById("Department");
  const userSelect = document.getElementById("userFilter");
  const searchInput = document.getElementById("projectSearch");
  const refreshButton = document.getElementById("refreshBtn");

  departmentSelect?.addEventListener("change", () => {
    filterContent();
    updateDepartmentWiseSummaries(departmentSelect.value);
    updateSummaryCards();
  });
  userSelect?.addEventListener("change", filterContent);
  searchInput?.addEventListener("input", filterContent);
  refreshButton?.addEventListener("click", () => location.reload());
}

function filterContent() {
  const department = document.getElementById("Department")?.value || "";
  const user = document.getElementById("userFilter")?.value || "";
  const query = (document.getElementById("projectSearch")?.value || "")
    .trim()
    .toLowerCase();

  const selectedUserId = user && user !== "all" ? user : null;
  const selectedUserName = selectedUserId
    ? apiUsers.find((u) => u.id === selectedUserId)?.name
    : null;

  if (query) {
    document
      .querySelectorAll(".user-card")
      .forEach((card) => card.classList.remove("user-active"));
    const filterStatus = document.getElementById("filterStatus");
    if (filterStatus) filterStatus.textContent = "";
    currentFilteredUserId = null;
  }

  document.querySelectorAll(".project-card").forEach((projectCard) => {
    const projectDepartment = projectCard.dataset.projectDepartment || "";
    const projectName = (
      projectCard.querySelector(".project-title")?.textContent || ""
    ).toLowerCase();
    const assigneeAvatars = projectCard.querySelectorAll(".assignee-avatar");

    let show = true;
    if (department && projectDepartment !== department) show = false;
    if (query && !projectName.includes(query)) show = false;
    if (selectedUserId && !currentFilteredUserId && show) {
      let hasUser = false;
      assigneeAvatars.forEach((avatar) => {
        if (avatar.dataset.userName === selectedUserName) hasUser = true;
      });
      if (!hasUser) show = false;
    }
    if (currentFilteredUserId && show) {
      let hasUser = false;
      const currentUser = apiUsers.find((u) => u.id === currentFilteredUserId);
      assigneeAvatars.forEach((avatar) => {
        if (currentUser && avatar.dataset.userName === currentUser.name)
          hasUser = true;
      });
      if (!hasUser) show = false;
    }
    projectCard.style.display = show ? "" : "none";
  });

  populateUserCards();
  updateAllCounts();
  updateSummaryCards();
}

// PER-PROJECT ACCEPTANCE MODAL - UPDATED: Show incremental task completion and auto-update status
function showAcceptanceModal(projectId, projectName) {
  const projectCard = document.querySelector(
    `[data-project-id="${projectId}"]`
  );
  if (!projectCard) return;

  const title = document.getElementById("acceptanceTitle");
  const body = document.getElementById("acceptanceContent");
  if (!title || !body) return;

  title.textContent = `Project Acceptances – ${sanitizeHTML(projectName)}`;

  const assigneeAvatars = projectCard.querySelectorAll(".assignee-avatar");
  const assignees = Array.from(assigneeAvatars).map((avatar) => {
    const userName = avatar.dataset.userName;
    const user = apiUsers.find((u) => u.name === userName);
    return { id: user ? user.id : generateUserId(), name: userName };
  });

  const acceptances = userAcceptanceData.acceptances.filter(
    (a) => a.projectId == projectId
  );
  const tasks = realTasks[projectId] || [];
  const completedTasks = tasks.filter((t) => t.status === "Completed").length;
  const totalTasks = tasks.length;

  let html = `
        <div class="mb-4">
            <p class="text-muted"><i class="bi bi-info-circle text-primary"></i> Review and manage acceptances for this project</p>
            <div class="bg-light p-3 rounded">
                <div><strong>Total Tasks:</strong> ${totalTasks}</div>
                <div><strong>Completed Tasks:</strong> ${completedTasks}</div>
                <div class="mt-2"><strong>Acceptance Summary:</strong>
                    <span class="text-info-custom ms-2">${
                      acceptances.filter(
                        (a) =>
                          a.status === "Y" &&
                          !isProjectFullyCompleted(projectId)
                      ).length
                    } InProgress</span> •
                    <span class="text-success ms-2">${
                      acceptances.filter((a) =>
                        isProjectFullyCompleted(projectId)
                      ).length
                    } Completed</span> •
                    <span class="text-warning-custom ms-2">${
                      assignees.length -
                      acceptances.filter((a) => a.status === "Y").length
                    } Pending</span> •
                    <span class="text-primary ms-2">${
                      assignees.length
                    } Total Assigned</span>
                </div>
            </div>
        </div>
        <div class="acceptance-grid">
    `;

  if (!assignees.length) {
    html += `<div class="empty-state text-center py-5"><i class="bi bi-people display-4 text-muted d-block mb-3"></i><p class="text-muted">No team members assigned.</p></div>`;
  } else {
    assignees.forEach((assignee) => {
      const acceptanceRecord = acceptances.find(
        (r) => r.userId === assignee.id.toString()
      );
      const accepted = acceptanceRecord
        ? acceptanceRecord.status === "Y"
        : false;
      const project = realProjects[projectId];

      // Determine status based on task completion
      const completed = isProjectFullyCompleted(projectId);
      const userTasks = tasks.filter(
        (task) =>
          task.assignedUsers && task.assignedUsers.includes(assignee.name)
      );
      const userCompletedTasks = userTasks.filter(
        (task) => task.status === "Completed"
      ).length;
      const userTotalTasks = userTasks.length;

      let taskHtml = "";
      if (userTasks.length) {
        taskHtml = `<div class="mt-2"><strong>Assigned Tasks:</strong><ul class="mt-1 ms-3">`;
        userTasks.forEach((task) => {
          const statusClass =
            task.status === "Completed"
              ? "text-success-custom"
              : task.status === "In Progress"
              ? "text-info"
              : "text-warning";
          taskHtml += `<li class="${statusClass}">${sanitizeHTML(
            task.name
          )} - <i class="bi bi-${
            task.status === "Completed"
              ? "check-circle"
              : task.status === "In Progress"
              ? "play-circle"
              : "clock"
          }"></i> ${task.status}</li>`;
        });
        taskHtml += `</ul><div class="small text-muted mt-1">Progress: ${userCompletedTasks}/${userTotalTasks} tasks completed</div></div>`;
      } else {
        taskHtml = `<div class="mt-2 text-muted"><i>No specific tasks assigned</i></div>`;
      }

      const button = completed
        ? `<button class="btn btn-success" disabled><i class="bi bi-check-circle"></i> Completed</button>`
        : accepted
        ? `<button class="btn btn-info" disabled><i class="bi bi-check"></i> In Progress</button>`
        : `<button class="bg-success text-white" onclick="toggleUserAcceptance('${projectId}','${
            assignee.id
          }','${assignee.name.replace(
            /'/g,
            "\\'"
          )}')"><i class="bi bi-check"></i> Accept Work</button>`;

      const date =
        accepted && acceptanceRecord?.createdAt
          ? `<div><strong>Accepted On:</strong> ${new Date(
              acceptanceRecord.createdAt
            ).toLocaleString()}</div>`
          : "";

      // Determine display status based on task completion
      const displayStatus = completed
        ? "Completed"
        : accepted
        ? "In Progress"
        : "Pending";
      const statusClass = completed
        ? "bg-success"
        : accepted
        ? "bg-info"
        : "bg-warning";

      html += `
                <div class="acceptance-card">
                    <div class="acceptance-header d-flex justify-content-between align-items-start mb-2">
                        <div class="acceptance-project-name fw-bold">${sanitizeHTML(
                          projectName
                        )}</div>
                        <span class="badge ${statusClass}"><i class="bi bi-${
        completed ? "check-circle" : accepted ? "play-circle" : "clock"
      }"></i> ${displayStatus}</span>
                    </div>
                    <div class="acceptance-details">
                        <div><strong>Assigned User:</strong> ${sanitizeHTML(
                          assignee.name
                        )}</div>
                        <div><strong>User ID:</strong> ${assignee.id}</div>
                        <div><strong>Project Status:</strong> ${displayStatus}</div>
                        ${date}
                        ${taskHtml}
                    </div>
                    <div class="acceptance-actions d-flex justify-content-between align-items-center mt-3">
                        ${button}
                    </div>
                </div>`;
    });
  }

  html += `</div>`;
  body.innerHTML = html;

  new bootstrap.Modal(document.getElementById("acceptanceModal")).show();
}

// TOGGLE USER ACCEPTANCE (POST to server)
async function toggleUserAcceptance(projectId, userId, userName) {
  if (getAcceptanceStatus(projectId, userId) === "Accepted") {
    showToast("Already accepted", "warning");
    return;
  }

  const projectName = realProjects[projectId]?.name || "Unknown";
  const tasks = (realTasks[projectId] || []).filter(
    (task) => task.assignedUsers && task.assignedUsers.includes(userName)
  );
  let taskList = "";
  if (tasks.length) {
    taskList = `<div class="text-start mt-3"><p class="fw-bold mb-2">Assigned Tasks:</p><ul class="bg-success ms-3">`;
    tasks.forEach(
      (task) => (taskList += `<li>${sanitizeHTML(task.name)}</li>`)
    );
    taskList += `</ul></div>`;
  } else {
    taskList = `<div class="text-start mt-3 text-muted"><i>No specific tasks assigned</i></div>`;
  }

  const result = await Swal.fire({
    title: "Accept Project?",
    html: `<div class="text-center"><p class="fw-bold text-primary fs-5">${sanitizeHTML(
      projectName
    )}</p>
               <p>Are you sure you want to accept this Work?</p>${taskList}</div>`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Accept",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#28a745",
    cancelButtonColor: "#dc3545",
  });
  if (!result.isConfirmed) return;

  try {
    const payload = {
      ProjectId: parseInt(projectId),
      UserId: userId,
      UserName: userName,
      ProjectName: projectName,
    };
    const response = await fetch("/ProjectAcceptance/Accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || "Failed");

    await loadAcceptanceDataFromDatabase();
    refreshProjectCardUI(projectId);
    showToast(
      `Project accepted – now in progress for ${sanitizeHTML(userName)}`,
      "success"
    );

    bootstrap.Modal.getInstance(
      document.getElementById("acceptanceModal")
    ).hide();
  } catch (error) {
    showToast("Error: " + error.message, "error");
  }
}

// PROJECT DETAILS MODAL
function showProjectDetails(projectId) {
  const project = realProjects[projectId];
  if (!project) return;

  const tasks = realTasks[projectId] || [];

  // Modal elements
  const title = document.getElementById("projectDetailsTitle");
  const body = document.getElementById("projectDetailsContent");
  if (!title || !body) return;
  title.textContent = sanitizeHTML(project.name);

  const statusBadge = document.getElementById("projectModalStatus");
  const status = project.status || "Pending";
  const statusClass =
    status === "Active"
      ? "bg-info"
      : status === "Completed"
      ? "bg-success"
      : "bg-warning";

  if (statusBadge) {
    statusBadge.className = `badge ${statusClass}`;
    statusBadge.innerHTML = `<i class="bi bi-${
      status === "Active"
        ? "play-circle"
        : status === "Completed"
        ? "check-circle"
        : "clock"
    }"></i> ${status}`;
  }

  // Completed tasks
  const completedTasks = tasks.filter((t) => t.status === "Completed").length;

  let html = `
        <div class="neat-modal-grid">
            <div class="grid-item"><div class="grid-label">Start Date</div><div class="grid-value">${
              project.startDate || "—"
            }</div></div>
            <div class="grid-item"><div class="grid-label">End Date</div><div class="grid-value">${
              project.endDate || "—"
            }</div></div>
            <div class="grid-item"><div class="grid-label">Department</div><div class="grid-value">${sanitizeHTML(
              project.department || "—"
            )}</div></div>
            <div class="grid-item"><div class="grid-label">Location</div><div class="grid-value">${sanitizeHTML(
              project.location || "—"
            )}</div></div>
            <div class="grid-item"><div class="grid-label">Client</div><div class="grid-value">${sanitizeHTML(
              project.clients || "—"
            )}</div></div>
            <div class="grid-item"><div class="grid-label">Status</div><div class="grid-value">${status}</div></div>
            <div class="grid-item"><div class="grid-label">Assigned Users</div><div class="grid-value">${sanitizeHTML(
              project.assignedUsers || "—"
            )}</div></div>
        </div>
        <div class="grid-item" style="grid-column:1/-1;">
            <div class="grid-label">Description</div>
            <div class="grid-value">${sanitizeHTML(
              project.description || "No description available."
            )}</div>
        </div>
        <div class="grid-label mt-3">Work Tasks (${completedTasks}/${
    tasks.length
  } Completed)</div>
        <div id="projectTasksList">
    `;

  if (!tasks.length) {
    html += `<div class="empty-state text-center py-3"><i class="bi bi-list-task text-muted d-block mb-2" style="font-size:2rem;"></i><p class="text-muted">No tasks found.</p></div>`;
  } else {
    tasks.forEach((task, index) => {
      const taskStatusClass =
        task.status === "Completed"
          ? "bg-success"
          : task.status === "In Progress"
          ? "bg-info"
          : "bg-warning";
      html += `
                <div class="task-row" onclick="showTaskDetails('${projectId}',${index})">
                    <div style="flex:1">
                        <div class="fw-bold text-primary">${sanitizeHTML(
                          task.name
                        )}</div>
                        <div class="text-muted small">Due: ${new Date(
                          task.dueDate
                        ).toLocaleDateString()}</div>
                    </div>
                    <span class="badge ${taskStatusClass}">
                        <i class="bi bi-${
                          task.status === "Completed"
                            ? "check-circle"
                            : task.status === "In Progress"
                            ? "play-circle"
                            : "clock"
                        }"></i> ${task.status}
                    </span>
                </div>`;
    });
  }

  html += `</div>`;
  body.innerHTML = html;

  new bootstrap.Modal(document.getElementById("projectDetailsModal")).show();
}

// TASK DETAILS MODAL
function showTaskDetails(projectId, taskIndex) {
  const task = realTasks[projectId][taskIndex];
  if (!task) return;
  const title = document.getElementById("taskDetailsTitle");
  const body = document.getElementById("taskDetailsContent");
  if (!title || !body) return;
  title.textContent = `Task Details – ${sanitizeHTML(task.name)}`;

  const statusBadge = document.getElementById("taskModalStatus");
  const statusClass =
    task.status === "Completed"
      ? "bg-success"
      : task.status === "In Progress"
      ? "bg-info"
      : "bg-warning";
  if (statusBadge) {
    statusBadge.className = `badge ${statusClass}`;
    statusBadge.innerHTML = `<i class="bi bi-${
      task.status === "Completed"
        ? "check-circle"
        : task.status === "In Progress"
        ? "play-circle"
        : "clock"
    }"></i> ${task.status}`;
  }

  const html = `
        <div class="neat-modal-grid">
            <div class="grid-item"><div class="grid-label">Task Name</div><div class="grid-value">${sanitizeHTML(
              task.name
            )}</div></div>
            <div class="grid-item"><div class="grid-label">Due Date</div><div class="grid-value">${new Date(
              task.dueDate
            ).toLocaleDateString()}</div></div>
            <div class="grid-item"><div class="grid-label">Department</div><div class="grid-value">${sanitizeHTML(
              task.department || "—"
            )}</div></div>
            <div class="grid-item"><div class="grid-label">Assigned Users</div><div class="grid-value">${sanitizeHTML(
              task.assignedUsers || "Unassigned"
            )}</div></div>
        </div>
        <div class="grid-item" style="grid-column:1/-1;">
            <div class="grid-label">Description</div>
            <div class="grid-value">${sanitizeHTML(
              task.description || "No description available."
            )}</div>
        </div>
    `;
  body.innerHTML = html;
  new bootstrap.Modal(document.getElementById("taskDetailsModal")).show();
}

// CHAT PANEL (full with fake auto-reply)
function initializeChatEvents() {
  const sendButton = document.getElementById("sendChatBtn");
  const chatInput = document.getElementById("chatInput");
  const closeButton = document.getElementById("closeChat");
  const overlay = document.getElementById("chatOverlay");

  sendButton?.addEventListener("click", sendChatMessage);
  chatInput?.addEventListener("keypress", (event) => {
    if (event.key === "Enter") sendChatMessage();
  });
  closeButton?.addEventListener("click", closeChat);
  overlay?.addEventListener("click", closeChat);
}

function openProjectChat(projectId, projectName) {
  activeChatProjectId = projectId;
  document.getElementById("chatTitle").textContent = sanitizeHTML(projectName);

  const membersContainer = document.getElementById("chatMembers");
  membersContainer.innerHTML = "";
  const projectCard = document.querySelector(
    `[data-project-id="${projectId}"]`
  );
  if (projectCard) {
    projectCard.querySelectorAll(".assignee-avatar").forEach((avatar) => {
      const userName = avatar.dataset.userName;
      const memberDiv = document.createElement("div");
      memberDiv.className = "member online";
      memberDiv.innerHTML = `<div class="member-avatar">${sanitizeHTML(
        userName.charAt(0)
      )}</div><div class="member-name">${sanitizeHTML(userName)}</div>`;
      membersContainer.appendChild(memberDiv);
    });
  }

  loadChatMessages(projectId);
  document.getElementById("chatPanel").classList.add("active");
  document.getElementById("chatOverlay").classList.add("active");
  document.body.style.overflow = "hidden";
}

function loadChatMessages(projectId) {
  const messagesContainer = document.getElementById("chatMessages");
  if (!messagesContainer) return;
  messagesContainer.innerHTML = "";
  const messages = window.serverData?.chatMessages?.[projectId] || [];

  if (!messages.length) {
    messagesContainer.innerHTML = `<div class="text-center text-muted py-5">
            <i class="bi bi-chat-dots display-4 d-block mb-3" style="color:#e9ecef;"></i>
            <p>No messages yet. Start the conversation!</p>
        </div>`;
    return;
  }

  messages.forEach((message) => {
    const messageGroup = document.createElement("div");
    messageGroup.className = "message-group";
    if (message.type === "system") {
      messageGroup.innerHTML = `<div class="message-content" style="text-center">
                <div class="message-bubble received" style="background:#e9ecef;color:#6c757d;font-style:italic;margin:0 auto;">
                    ${sanitizeHTML(message.message)}
                </div>
                <div style="font-size:0.75rem;color:#6c757d;margin-top:0.5rem;">
                    ${new Date(message.timestamp).toLocaleTimeString()}
                </div>
            </div>`;
    } else {
      const isSent = message.type === "sent";
      messageGroup.innerHTML = `
                <div class="message-header">
                    <div class="message-avatar">${sanitizeHTML(
                      message.sender.charAt(0)
                    )}</div>
                    <div class="message-sender">${sanitizeHTML(
                      message.sender
                    )}</div>
                    <div class="message-time">${new Date(
                      message.timestamp
                    ).toLocaleTimeString()}</div>
                </div>
                <div class="message-content">
                    <div class="message-bubble ${
                      isSent ? "sent" : "received"
                    }">${sanitizeHTML(message.message)}</div>
                </div>`;
    }
    messagesContainer.appendChild(messageGroup);
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
  if (!activeChatProjectId) {
    showToast("No active chat", "warning");
    return;
  }
  const chatInput = document.getElementById("chatInput");
  if (!chatInput) return;
  const messageText = chatInput.value.trim();
  if (!messageText) {
    showToast("Enter a message", "warning");
    return;
  }

  if (!window.serverData.chatMessages) window.serverData.chatMessages = {};
  if (!window.serverData.chatMessages[activeChatProjectId])
    window.serverData.chatMessages[activeChatProjectId] = [];

  const message = {
    id: window.serverData.chatMessages[activeChatProjectId].length + 1,
    sender: "You",
    message: messageText,
    timestamp: new Date().toISOString(),
    type: "sent",
  };
  window.serverData.chatMessages[activeChatProjectId].push(message);
  chatInput.value = "";
  loadChatMessages(activeChatProjectId);

  setTimeout(() => {
    const replies = [
      "Thanks for the update! I'll review this right away.",
      "Great progress! Let me know if you need any assistance.",
      "I've completed my part of the tasks. Ready for review.",
      "Can we schedule a quick sync meeting to discuss this?",
      "The deadline is approaching. Any blockers I can help with?",
      "I've updated the documentation with the latest changes.",
      "The client provided some feedback. Let me share it with the team.",
    ];
    const teamMembers = [
      "Alex Johnson",
      "Sarah Chen",
      "Mike Rodriguez",
      "Emily Davis",
      "David Kim",
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    const sender = teamMembers[Math.floor(Math.random() * teamMembers.length)];

    const replyMessage = {
      id: window.serverData.chatMessages[activeChatProjectId].length + 1,
      sender: sender,
      message: reply,
      timestamp: new Date().toISOString(),
      type: "received",
    };
    window.serverData.chatMessages[activeChatProjectId].push(replyMessage);
    loadChatMessages(activeChatProjectId);
    if (document.hidden) showToast(`New message from ${sender}`, "info");
  }, 1500 + Math.random() * 2000);
}

function closeChat() {
  document.getElementById("chatPanel").classList.remove("active");
  document.getElementById("chatOverlay").classList.remove("active");
  document.body.style.overflow = "";
  activeChatProjectId = null;
}

// TOAST NOTIFICATIONS
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-white bg-${
    type === "success"
      ? "success"
      : type === "warning"
      ? "warning"
      : type === "error"
      ? "danger"
      : "primary"
  } border-0`;
  toast.setAttribute("role", "alert");
  toast.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  const container =
    document.getElementById("toastContainer") || createToastContainer();
  container.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
  bsToast.show();
  toast.addEventListener("hidden.bs.toast", () => toast.remove());
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toastContainer";
  container.className = "toast-container position-fixed top-0 end-0 p-3";
  container.style.zIndex = "9999";
  document.body.appendChild(container);
  return container;
}

// TASK STATUS CHANGE HANDLER - UPDATED: This is the main function that handles task updates
window.onTaskStatusChanged = async function (projectId, taskId, newStatus) {
  const task = realTasks[projectId]?.find((t) => t.id == taskId);
  if (task) {
    task.status = newStatus;
    showToast(`Task updated to ${newStatus}`, "info");

    // Refresh the project card UI with updated task counts
    refreshProjectCardUI(projectId);

    // Check and update project completion status
    updateProjectCompletionStatus(projectId);

    // Refresh all acceptance records modal if open
    if (
      document.getElementById("allAcceptancesModal")?.classList.contains("show")
    ) {
      setTimeout(showAllAcceptances, 200);
    }

    // Update all counts and summaries
    updateAllCounts();
    updateSummaryCards();
  }
};

// MISC HELPERS
function generateTaskId() {
  return "task-" + Math.random().toString(36).substr(2, 9);
}

function updateUserAcceptanceData() {
  updateAllProjectAcceptanceStatus();
  updateUserCardsAcceptanceStatus();
  updateAllCounts();
  updateSummaryCards();
}
