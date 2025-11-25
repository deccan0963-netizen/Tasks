$(document).ready(function () {
  // --- Utilities ---
  function getStatusName(statusCode) {
    for (var key in StatusEnum) {
      if (StatusEnum[key] === parseInt(statusCode)) {
        return key.replace(/([A-Z])/g, " $1").trim();
      }
    }
    return "Unknown";
  }

  function formatDate(dateString) {
    if (!dateString || dateString === "N/A") return "N/A";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString;
    }
  }

  function normalizeTasksArray(maybeTasks) {
    if (!maybeTasks) return [];
    if (Array.isArray(maybeTasks)) return maybeTasks;
    if (maybeTasks.$values && Array.isArray(maybeTasks.$values)) return maybeTasks.$values;
    return Object.values(maybeTasks);
  }

  function taskIdOf(t) {
    return t.id || t.Id || t.$id || t.TaskId || t.taskId || "";
  }

  function toArrayAccepts(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") {
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      } catch (e) { return [raw]; }
    }
    if (raw.$values && Array.isArray(raw.$values)) return raw.$values.map(String);
    if (typeof raw === "object") return Object.values(raw).map(String);
    return [String(raw)];
  }

  // NEW: Universal function to normalize any array data
  function normalizeArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.$values && Array.isArray(data.$values)) return data.$values;
    if (typeof data === 'object') return Object.values(data);
    if (typeof data === 'string') return data.split(',').map(x => x.trim()).filter(x => x);
    return [data];
  }

  // NEW: Convert user IDs to usernames
  function convertUserIdsToUsernames(userIds) {
    const normalized = normalizeArray(userIds);
    return normalized.map(userId => {
      if (typeof userId === 'number') userId = String(userId);
      const user = users.find(u => String(u.id) === String(userId) || u.userName === userId);
      return user ? user.userName : userId;
    });
  }

  // --- Global Variables ---
  var currentStatusFilter = "all", currentUserFilter = "all", currentSearchTerm = "", currentUserSearchTerm = "";
  var projectTasksCache = {}, projectAcceptedTasksCache = {}, userProjectCounts = {};
  var projectUsersCache = {};

  // --- Core Functions ---
  function calculateUserProjectCounts() {
    userProjectCounts = {};
    projects.forEach((p) => {
      const projectId = p.Id;
      
      // Get assigned users from cache or initial data
      const assignedUsers = projectUsersCache[projectId] || 
                           getAssignedUsersFromProject(p) || 
                           [];
      
      // Project-level assignments
      assignedUsers.forEach((username) => {
        const user = username.trim();
        if (user && user !== "N/A") {
          if (!userProjectCounts[user]) userProjectCounts[user] = new Set();
          userProjectCounts[user].add(projectId);
        }
      });
      
      // Task-level assignments
      const tasks = projectTasksCache[p.Id] || normalizeTasksArray(p.tasks || []);
      tasks.forEach((task) => {
        const addUser = (user) => {
          if (user && user !== "N/A" && typeof user === 'string') {
            if (!userProjectCounts[user]) userProjectCounts[user] = new Set();
            userProjectCounts[user].add(projectId);
          }
        };

        if (task.assignedUser && typeof task.assignedUser === 'string') addUser(task.assignedUser.trim());
        if (task.assignedBy && typeof task.assignedBy === 'string') addUser(task.assignedBy.trim());
        
        const taskAssignedUsers = normalizeArray(task.assignedUsers);
        taskAssignedUsers.forEach(user => {
          if (typeof user === 'string') addUser(user.trim());
        });
      });
    });
    
    // Convert Sets to numbers
    Object.keys(userProjectCounts).forEach(user => {
      userProjectCounts[user] = userProjectCounts[user].size;
    });
  }

  // Helper function to extract assigned users from project data
  function getAssignedUsersFromProject(project) {
    // Try different possible properties and formats
    if (project.assignedUsers) {
      return convertUserIdsToUsernames(project.assignedUsers);
    }
    if (project.AssignedUsers) {
      return convertUserIdsToUsernames(project.AssignedUsers);
    }
    if (project.SelectedUserNames) {
      return convertUserIdsToUsernames(project.SelectedUserNames);
    }
    return [];
  }

  function calculateProjectProgress(project) {
    var tasks = projectTasksCache[project.Id] || normalizeTasksArray(project.tasks || []);
    if (tasks.length === 0) return 0;
    var completedTasks = tasks.filter(t => parseInt(t.status || t.Status || 0) === 3);
    return Math.round((completedTasks.length / tasks.length) * 100);
  }

  function getTaskCountsByStatus(project) {
    var tasks = projectTasksCache[project.Id] || normalizeTasksArray(project.tasks || []);
    var pending = 0, inProgress = 0, completed = 0;
    var acceptedSet = new Set(toArrayAccepts(projectAcceptedTasksCache[project.Id] || project.acceptedTasks || []).map(String));

    tasks.forEach(task => {
      var status = parseInt(task.status || task.Status || 0);
      var isAccepted = acceptedSet.has(String(taskIdOf(task)));

      if (status === 3) completed++;
      else if (status === 2 || isAccepted) inProgress++;
      else pending++;
    });

    return { pending, inProgress, completed };
  }

  function getAllProjectUsers(project) {
    var allUsers = new Set();
    var tasks = projectTasksCache[project.Id] || normalizeTasksArray(project.tasks || []);

    // Project-level users
    const assignedUsers = projectUsersCache[project.Id] || getAssignedUsersFromProject(project);
    assignedUsers.forEach(user => {
      if (user && user !== "N/A" && typeof user === 'string') {
        allUsers.add(user.trim());
      }
    });

    // Task-level users
    tasks.forEach(task => {
      const addUser = (user) => {
        if (user && user !== "N/A" && typeof user === 'string') {
          allUsers.add(user.trim());
        }
      };
      
      if (task.assignedUser) addUser(task.assignedUser);
      // if (task.assignedBy) addUser(task.assignedBy);
      
      const taskAssignedUsers = normalizeArray(task.assignedUsers);
      taskAssignedUsers.forEach(addUser);
    });

    return Array.from(allUsers);
  }

  function loadProjectTasks(projectId) {
    return new Promise((resolve) => {
      $.ajax({
        url: "/Project/GetProjectDetails", type: "GET", data: { id: projectId },
        success: function (response) {
          if (response?.success && response.data) {
            projectTasksCache[projectId] = normalizeTasksArray(response.data.tasks || []);
            if (response.data.acceptedTasks) projectAcceptedTasksCache[projectId] = response.data.acceptedTasks;
            
            // Cache the assigned users from the detailed response
            if (response.data.assignedUsers) {
              // Use the universal normalizer and convert to usernames
              projectUsersCache[projectId] = convertUserIdsToUsernames(response.data.assignedUsers);
            }
          }
          resolve();
        },
        error: () => resolve()
      });
    });
  }

  function loadAllProjectTasks() {
    Promise.all(projects.map(p => loadProjectTasks(p.Id))).then(() => {
      calculateUserProjectCounts();
      renderProjects(projects, currentStatusFilter, currentSearchTerm);
      renderAssignedUsers();
    });
  }

  // --- Rendering Functions ---
  function renderAssignedUsers() {
    var $userList = $("#userList").empty();
    
    $userList.append(`
      <div class="user-item ${currentUserFilter === "all" ? "active" : ""}" data-user="all">
        <div class="user-avatar">ALL</div>
        <div>
          <div style="font-weight:600;">All WorkSegments</div>
          <div style="font-size:12px; color:#94a3b8;">${projects.length} total</div>
        </div>
      </div>
    `);

    const usersWithProjects = users
      .filter(u => userProjectCounts[u.userName] > 0 && u.isActive !== false)
      .sort((a, b) => (userProjectCounts[b.userName] || 0) - (userProjectCounts[a.userName] || 0));

    usersWithProjects.forEach(u => {
      const count = userProjectCounts[u.userName] || 0;
      $userList.append(`
        <div class="user-item ${currentUserFilter === u.userName ? "active" : ""}" data-user="${u.userName}">
          <div class="user-avatar">${u.userName.substring(0, 2).toUpperCase()}</div>
          <div style="flex-grow:1;">
            <div style="font-weight:600;">${u.userName}</div>
            <div style="font-size:12px; color:#94a3b8;">BioID: ${u.bioid || "N/A"}</div>
          </div>
          <div class="user-project-count-badge">${count}</div>
        </div>
      `);
    });

    $("#userCount").text(usersWithProjects.length);
  }

  function filterProjectsByUser(userName) {
    if (userName === "all") return projects;
    return projects.filter(p => {
      // Check project-level assignments
      const assignedUsers = projectUsersCache[p.Id] || getAssignedUsersFromProject(p);
      if (assignedUsers && assignedUsers.includes(userName)) return true;
      
      // Check task-level assignments
      var projectTasks = projectTasksCache[p.Id] || [];
      return projectTasks.some(task => {
        if (task.assignedUser && task.assignedUser.trim() === userName) return true;
        if (task.assignedBy && task.assignedBy.trim() === userName) return true;
        
        const taskAssignedUsers = normalizeArray(task.assignedUsers);
        return taskAssignedUsers.includes(userName);
      });
    });
  }

  function renderProjects(list, statusFilter = "all", searchTerm = "") {
    $("#projectsGrid").empty();

    var filteredList = list.filter((p) => {
        var statusMatch =
            statusFilter === "all" ||
            (statusFilter === "active" && p.Status != 3) ||
            (statusFilter === "completed" && p.Status == 3);
        if (!statusMatch || !searchTerm) return statusMatch;

        var projectName = p.ProjectName || "Unknown Project";
        var description = (p.Description || "").toLowerCase();
        var dept = departments.find(
            (d) => String(d.SectionId) === String(p.Department)
        );
        var deptName = (dept ? dept.SectionName : "").toLowerCase();

        return (
            projectName.includes(searchTerm.toLowerCase()) ||
            description.includes(searchTerm.toLowerCase()) ||
            deptName.includes(searchTerm.toLowerCase())
        );
    });

    filteredList.forEach((p) => {
        var projectName = p.ProjectName || "Unknown Project";
        var allProjectUsers = getAllProjectUsers(p);
        
        console.log(`Project ${p.Id} users:`, allProjectUsers);
        
        var userAvatars = '';
        if (allProjectUsers.length > 0) {
            userAvatars = allProjectUsers.slice(0, 3).map((userName) => 
                `<div class="team-avatar" title="${userName}">${userName.substring(0, 2).toUpperCase()}</div>`
            ).join("");
        }

        var dept = departments.find(
            (d) => String(d.SectionId) === String(p.Department)
        );
        var statusName = getStatusName(p.Status);
        var progressPercent = calculateProjectProgress(p);
        var taskCounts = getTaskCountsByStatus(p);
        var totalTasks = taskCounts.pending + taskCounts.inProgress + taskCounts.completed;

        var endDate = formatDate(p.EndDate);

        $("#projectsGrid").append(`
            <div class="project-card" data-project="${p.Id}" data-users="${allProjectUsers.join(",")}">
                <a href="#" class="history-btn" data-project="${p.Id}"><i class="bi bi-clock-history"></i></a>
                <div class="project-priority ${statusName.toLowerCase().replace(" ", "-")}">${statusName}</div>
                <div class="project-title">${p.ProjectName || "Unknown Project"}</div>
                <span class="project-dept">${dept ? dept.SectionName : ""}</span>
                <p class="project-description">${p.Description || ""}</p>

                <div class="task-status-counts">
                    ${
                        totalTasks > 0
                            ? `
                        <span class="task-count-badge pending" title="Pending Tasks">${taskCounts.pending} Pending</span>
                        <span class="task-count-badge inprogress" title="In Progress Tasks">${taskCounts.inProgress} In Progress</span>
                        <span class="task-count-badge completed" title="Completed Tasks">${taskCounts.completed} Completed</span>
                        `
                            : '<span class="task-count-badge completed">No Tasks</span>'
                    }
                </div>
                
                <div class="project-meta">
                    <div class="project-deadline"><i class="bi bi-calendar"></i> End:<br>${endDate}</div>
                    <div class="progress-container"><div class="progress-bar" style="width:${progressPercent}%"></div></div>
                    <div class="project-progress-value">${progressPercent}%</div>
                </div>
                
                <div class="project-footer">
                    <div class="project-team">
                      ${userAvatars}
                      ${
                        allProjectUsers.length > 3
                          ? `<div class="team-count">+${allProjectUsers.length - 3} more</div>`
                          : allProjectUsers.length > 0
                          ? `<div class="team-count">${allProjectUsers.length} members</div>`
                          : '<div class="team-count">No members</div>'
                      }
                    </div>
                     
                    <div class="project-actions">
                        <a href="#" class="project-icon ViewProject-Details-btn" data-project="${p.Id}"><i class="bi bi-eye"></i></a>
                        <a href="#" class="project-icon ViewDetailsModal" data-project="${p.Id}"><i class="bi bi-people"></i></a>
                    </div>
                </div>
            </div>
        `);
    });

    $("#projectCount").text(filteredList.length);
  }

  // --- Modal Rendering ---
  function renderModal(modalId, projectId, renderFunction) {
    $(modalId).modal("show");
    $.ajax({
      url: "/Project/GetProjectDetails", type: "GET", data: { id: projectId },
      success: (response) => {
        if (!response?.success) {
          Swal.fire("Error", response?.error || "Unable to load project details", "error");
          $(modalId).modal("hide");
          return;
        }
        // Update cache with fresh data and normalize
        if (response.data.assignedUsers) {
          response.data.assignedUsers = convertUserIdsToUsernames(response.data.assignedUsers);
          projectUsersCache[projectId] = response.data.assignedUsers;
        }
        renderFunction(response.data);
      },
      error: () => {
        Swal.fire("Error", "Server error while fetching project details", "error");
        $(modalId).modal("hide");
      }
    });
  }

  function renderProjectDetailsModal(project) {
    $("#v-status-badge").text(project.statusName || "Unknown").attr("class", `status-badge status-${(project.statusName || "unknown").toString().toLowerCase().replace(/\s/g, "")}`);
    $("#v-projectname").text(project.projectName || "N/A");
    $("#v-dept").text(project.departmentName || "N/A");
    $("#v-location").text(project.location || "N/A");
    
    $("#v-startdate").text(formatDate(project.startingDate) || "N/A");
    $("#v-assignedby").text(project.assignedBy || "N/A");

    // Normalize assigned users data
    var allUserNames = normalizeArray(project.assignedUsers || []);
    console.log("Project details modal users:", allUserNames);
    
    $("#v-users").text(allUserNames.length ? allUserNames.join(", ") : "No users assigned");
    $("#v-teamsize").text(allUserNames.length + " Member" + (allUserNames.length !== 1 ? "s" : ""));
    $("#v-desc").text(project.description || "No Description / Requirements");

    var tasksContainer = $("#v-tasks-container").empty();
    
    var tasks = projectTasksCache[project.Id] || [...new Map(normalizeTasksArray(project.tasks || []).map(t => [taskIdOf(t), t])).values()];
    var acceptedSet = new Set(toArrayAccepts(project.acceptedTasks || []).map(String));

    if (!tasks.length) {
      tasksContainer.append('<div class="no-tasks">No tasks assigned to this project</div>');
      return;
    }

    tasks.forEach(t => {
      var taskId = taskIdOf(t);
      var isAccepted = acceptedSet.has(String(taskId));
      var status = parseInt(t.status || t.Status || 0);
      
      var badgeClass = status === 3 ? "bg-success" : isAccepted ? "bg-primary" : "bg-warning";
      var badgeText = status === 3 ? "Completed" : isAccepted ? "Accepted" : "Pending";
      
      // Handle assigned users
      var assignedUsers = convertUserIdsToUsernames(t.assignedUsers || []);
      
      var userDisplay = assignedUsers.length > 0 ? assignedUsers.join(", ") : "Unassigned";
      
      var userAvatars = assignedUsers.length > 0 
        ? assignedUsers.map(user => 
            `<div class="task-user-avatar-small" title="${user}">${user.substring(0, 2).toUpperCase()}</div>`
          ).join('')
        : '<div class="task-user-avatar-small" title="Unassigned">US</div>';

      var dueDate = formatDate(t.dueDate);
      var completedDate = formatDate(t.completedDate);

      var $card = $(`
        <div class="task-card" data-taskid="${taskId}">
          <div class="task-header">
            <div class="task-title">${t.title || t.TaskName || "Untitled Task"}</div>
            <span class="status-label ${badgeClass}">${badgeText}</span>
          </div>
          <div class="task-meta">
            <div class="task-user">
              <div class="task-user-avatars">${userAvatars}</div>
              <span class="task-user-names">${userDisplay}</span>
            </div>
          </div>
          <button class="show-more-btn">Show More</button>
          <div class="more-content" style="display:none;">
            <div class="task-assigned-by"><strong>Assigned by:</strong> ${t.assignedBy || "N/A"}</div>
            <div class="task-description-block"><strong>Task Description:</strong><p class="task-details">${t.description || "No description provided"}</p></div>
            <div class="task-dates">
              <div class="task-due-date">📅 Due: ${dueDate}</div>
              ${t.completedDate && t.completedDate !== "N/A" ? `<div class="task-completed-date">✅ Completed: ${completedDate}</div>` : ""}
            </div>
          </div>
        </div>
      `);

      $card.find(".show-more-btn").on("click", function () {
        var $more = $card.find(".more-content");
        $more.slideToggle(200);
        $(this).text($more.is(":visible") ? "Show Less" : "Show More");
      });

      tasksContainer.append($card);
    });
  }

  function renderTeamModal(project) {
    $("#project-info .project-name").text(project.projectName || "N/A");
    $("#project-info .project-assignedby").text("Assigned by: " + (project.assignedBy || "N/A"));
    $("#t-status-badge").text(project.statusName || "Unknown").attr("class", `status-badge status-${(project.statusName || "unknown").toString().toLowerCase().replace(/\s/g, "")}`);

    // Normalize assigned users data
    var allUserNames = normalizeArray(project.assignedUsers || []);
    console.log("Team modal users:", allUserNames);
    
    $("#project-info .project-users").text(allUserNames.length ? "Assigned Users: " + allUserNames.join(", ") : "No users assigned");

    var $list = $("#team-task-list").empty();
    
    var tasks = projectTasksCache[project.Id] || normalizeTasksArray(project.tasks || []);
    var acceptedSet = new Set(toArrayAccepts(project.acceptedTasks || []).map(String));

    if (!tasks.length) {
      $list.append('<li class="list-group-item">No tasks assigned.</li>');
      return;
    }

    tasks.forEach(t => {
      var taskId = String(taskIdOf(t)), isAccepted = acceptedSet.has(taskId);
      var status = parseInt(t.status || t.Status || 0);
      
      // Handle assigned users
      var assignedUsers = convertUserIdsToUsernames(t.assignedUsers || []);
      
      var userDisplay = assignedUsers.length > 0 ? assignedUsers.join(", ") : "Unassigned";
      
      var userAvatars = assignedUsers.length > 0 
        ? assignedUsers.map(user => 
            `<div class="member-avatar-small" title="${user}">${user.substring(0, 2).toUpperCase()}</div>`
          ).join('')
        : '<div class="member-avatar-small" title="Unassigned">US</div>';

      var assignedDate = formatDate(t.assignedDate);
      var completedDate = formatDate(t.completedDate);

      var $li = $(`
        <li class="list-group-item task-card" data-taskid="${taskId}">
          <div class="member-header d-flex align-items-center gap-2">
            <div class="member-avatars-container">${userAvatars}</div>
            <div class="member-name">${userDisplay}</div>
          </div>
          <div class="task-name mt-2">
            <div><strong>Task Name:</strong> ${t.title || t.TaskName || "Untitled Task"}</div>
            <div><strong>Assigned Date:</strong> ${assignedDate}</div>
          </div>
          <button class="show-more-btn mt-2">Show More</button>
          <div class="more-content mt-2" style="display:none;">
            <div><strong>Assigned By:</strong> ${t.assignedBy || "N/A"}</div>
            <div><strong>Description:</strong></div>
            <div class="task-details">${t.description || "No description provided"}</div>
            ${t.completedDate && t.completedDate !== "N/A" ? `<div><strong>Completed:</strong> ${completedDate}</div>` : ""}
          </div>
          <div class="status-container mt-2"></div>
        </li>
      `);

      var $statusContainer = $li.find(".status-container").empty();
      
      if (status === 3) {
        $statusContainer.append('<span class="badge bg-success">Completed</span>');
      } else if (isAccepted) {
        $statusContainer.append('<span class="badge bg-primary">Accepted</span>');
      } else {
        // For multiple users, show accept button for each user
        assignedUsers.forEach(user => {
          $statusContainer.append(`<button class="accept-btn btn btn-sm btn-outline-success me-1 mb-1" data-taskid="${taskId}" data-userid="${user}">Accept (${user})</button>`);
        });
      }

      $li.find(".show-more-btn").on("click", function () {
        var $more = $li.find(".more-content");
        var expanded = $more.is(":visible");
        $more.slideToggle(200);
        $(this).text(expanded ? "Show More" : "Show Less");
      });

      $list.append($li);
    });
  }

  function renderHistoryModal(project) {
    // History modal implementation
    console.log("Rendering history for project:", project);
  }

  // --- Event Handlers ---
  $("#searchInput").on("input", function () {
    currentUserSearchTerm = $(this).val().trim().toLowerCase();
    $("#userList .user-item").each(function () {
      var userName = $(this).data("user").toLowerCase();
      $(this).toggle(userName === "all" || userName.includes(currentUserSearchTerm));
    });
  });

  $(document).on("click", ".user-item", function () {
    $(".user-item").removeClass("active");
    $(this).addClass("active");
    currentUserFilter = $(this).data("user");
    renderProjects(filterProjectsByUser(currentUserFilter), currentStatusFilter, currentSearchTerm);
    renderAssignedUsers();
  });

  $(document).on("click", ".filter-btn", function () {
    $(".filter-btn").removeClass("active");
    $(this).addClass("active");
    currentStatusFilter = $(this).text().toLowerCase();
    renderProjects(filterProjectsByUser(currentUserFilter), currentStatusFilter, currentSearchTerm);
  });

  $(document).on("click", ".ViewProject-Details-btn", function (e) {
    e.preventDefault();
    renderModal("#ProjectViewModal", $(this).data("project"), renderProjectDetailsModal);
  });

  $(document).on("click", ".ViewDetailsModal", function (e) {
    e.preventDefault();
    renderModal("#ViewTeamModal", $(this).data("project"), renderTeamModal);
  });

  $(document).on("click", ".history-btn", function (e) {
    e.preventDefault();
    renderModal("#workingProjectsModal", $(this).data("project"), renderHistoryModal);
  });

  $(document).on("click", ".accept-btn", function () {
    var $btn = $(this), taskId = $btn.data("taskid"), userId = $btn.data("userid");
    if (!taskId || !userId) {
      Swal.fire("Error", "Invalid data: Task ID or User ID missing", "error");
      return;
    }

    $btn.prop("disabled", true).text("Processing...");

    Swal.fire({
      title: "Confirm Acceptance", html: "Do you want to accept this task?", icon: "question",
      showCancelButton: true, confirmButtonText: "Yes, Accept", cancelButtonText: "Cancel",
      confirmButtonColor: "#1e3c72", cancelButtonColor: "#d33"
    }).then((result) => {
      if (!result.isConfirmed) {
        $btn.prop("disabled", false).text("Accept");
        return;
      }

      $.ajax({
        url: "/TaskAcceptance/Accept", type: "POST", contentType: "application/json",
        data: JSON.stringify({ TaskId: taskId, UserId: userId }),
        success: function (res) {
          if (res?.success) {
            Swal.fire({ icon: "success", title: "Task Accepted ✅", text: res.message || "You can now work on this task.", timer: 1400, showConfirmButton: false });
            var $statusContainer = $btn.closest(".status-container");
            $statusContainer.find("span.bg-warning").remove();
            $btn.remove();
            $statusContainer.append(res.taskStatus == 3 ? '<span class="badge bg-success">Completed</span>' : '<span class="badge bg-primary">Accepted</span>');

            var $modal = $btn.closest(".modal");
            var projectId = $modal.find(".project-card").data("project") || $btn.closest(".project-card").data("project");
            if (projectId) {
              delete projectTasksCache[projectId];
              delete projectAcceptedTasksCache[projectId];
              delete projectUsersCache[projectId];
              loadAllProjectTasks().then(() => {
                renderProjects(filterProjectsByUser(currentUserFilter), currentStatusFilter, currentSearchTerm);
                renderAssignedUsers();
              });
            }
          } else {
            Swal.fire("Info", res?.message || "Task marked accepted.", "info");
            $btn.prop("disabled", false).text("Accept");
          }
        },
        error: () => {
          Swal.fire("Error", "Server error while accepting task", "error");
          $btn.prop("disabled", false).text("Accept");
        }
      });
    });
  });

  // --- Initialize ---
  function initializePage() {
    renderProjects(projects, currentStatusFilter, currentSearchTerm);
    loadAllProjectTasks();
  }

  initializePage();
});