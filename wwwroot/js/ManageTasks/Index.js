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

  function getProjectName(projectId) {
    for (var key in ProjectEnum) {
      if (ProjectEnum[key] === parseInt(projectId)) {
        return key.replace(/([A-Z])/g, " $1").trim();
      }
    }
    return "Unknown Project";
  }

  function formatDate(dateString) {
    if (!dateString || dateString === "N/A") return "N/A";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString; // Return original if parsing fails
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

  // --- Global Variables ---
  var currentStatusFilter = "all", currentUserFilter = "all", currentSearchTerm = "", currentUserSearchTerm = "";
  var projectTasksCache = {}, projectAcceptedTasksCache = {}, userProjectCounts = {};

  // --- Core Functions ---
  function calculateUserProjectCounts() {
    userProjectCounts = {};
    projects.forEach((p) => {
      const projectId = p.Id;
      
      // Project-level assignments
      if (p.AssignedUsers) {
        p.AssignedUsers.split(",").forEach((name) => {
          const user = name.trim();
          if (user) {
            if (!userProjectCounts[user]) userProjectCounts[user] = new Set();
            userProjectCounts[user].add(projectId);
          }
        });
      }
      
      // Task-level assignments - FIXED: Always include tasks even for completed projects
      const tasks = projectTasksCache[p.Id] || normalizeTasksArray(p.tasks || []);
      tasks.forEach((task) => {
        const addUser = (user) => {
          if (user && user !== "N/A") {
            if (!userProjectCounts[user]) userProjectCounts[user] = new Set();
            userProjectCounts[user].add(projectId);
          }
        };

        if (task.assignedUser) addUser(task.assignedUser.trim());
        if (task.assignedBy) addUser(task.assignedBy.trim());
        
        if (task.assignedUsers) {
          const users = Array.isArray(task.assignedUsers) ? task.assignedUsers 
            : typeof task.assignedUsers === "string" ? task.assignedUsers.split(",").map(x => x.trim()) : [];
          users.forEach(addUser);
        }
      });
    });
    
    // Convert Sets to numbers
    Object.keys(userProjectCounts).forEach(user => {
      userProjectCounts[user] = userProjectCounts[user].size;
    });
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
    // FIXED: Always get tasks even for completed projects
    var tasks = projectTasksCache[project.Id] || normalizeTasksArray(project.tasks || []);

    // Project-level users
    if (project.assignedUsers) {
      var projectUsers = Array.isArray(project.assignedUsers) ? project.assignedUsers 
        : project.assignedUsers.$values || [project.assignedUsers];
      projectUsers.forEach(user => user && user !== "N/A" && allUsers.add(user.trim()));
    }

    // Task-level users
    tasks.forEach(task => {
      const addUser = (user) => user && user !== "N/A" && allUsers.add(user.trim());
      
      if (task.assignedUser) addUser(task.assignedUser);
      if (task.assignedBy) addUser(task.assignedBy);
      
      if (task.assignedUsers) {
        var usersArray = Array.isArray(task.assignedUsers) ? task.assignedUsers 
          : typeof task.assignedUsers === "string" ? task.assignedUsers.split(",").map(x => x.trim())
          : task.assignedUsers.$values || [];
        usersArray.forEach(addUser);
      }
    });

    return Array.from(allUsers);
  }

  function loadProjectTasks(projectId) {
    return new Promise((resolve) => {
      $.ajax({
        url: "/Project/GetProjectDetails", type: "GET", data: { id: projectId },
        success: function (response) {
          if (response?.success && response.data) {
            // FIXED: Always cache tasks even for completed projects
            projectTasksCache[projectId] = normalizeTasksArray(response.data.tasks || []);
            if (response.data.acceptedTasks) projectAcceptedTasksCache[projectId] = response.data.acceptedTasks;
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
      if (p.AssignedUsers && p.AssignedUsers.split(",").map(x => x.trim()).includes(userName)) return true;
      var projectTasks = projectTasksCache[p.Id] || [];
      return projectTasks.some(task => {
        if (task.assignedUser && task.assignedUser.trim() === userName) return true;
        if (task.assignedBy && task.assignedBy.trim() === userName) return true;
        if (task.assignedUsers) {
          var assignedUsers = Array.isArray(task.assignedUsers) ? task.assignedUsers 
            : typeof task.assignedUsers === "string" ? task.assignedUsers.split(",").map(x => x.trim()) : [];
          return assignedUsers.includes(userName);
        }
        return false;
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

        var projectName = getProjectName(p.ProjectId).toLowerCase();
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
        var projectName = getProjectName(p.ProjectId);
        var allProjectUsers = new Set();

        // Get project-level assigned users
        var projectAssignedUsers = p.AssignedUsers
            ? p.AssignedUsers.split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
            : [];
        projectAssignedUsers.forEach((user) => allProjectUsers.add(user));

        // FIXED: Always get tasks even for completed projects
        var projectTasks = projectTasksCache[p.Id] || [];
        projectTasks.forEach((task) => {
            if (task.assignedUser && task.assignedUser !== "N/A") {
                allProjectUsers.add(task.assignedUser.trim());
            }

            if (task.assignedUsers) {
                var usersArray = [];
                if (Array.isArray(task.assignedUsers)) {
                    usersArray = task.assignedUsers;
                } else if (typeof task.assignedUsers === "string") {
                    usersArray = task.assignedUsers.split(",").map((x) => x.trim());
                }

                usersArray.forEach((user) => {
                    if (user && user !== "N/A") {
                        allProjectUsers.add(user);
                    }
                });
            }

            if (task.assignedBy && task.assignedBy !== "N/A") {
                allProjectUsers.add(task.assignedBy.trim());
            }
        });

        var allUserNames = Array.from(allProjectUsers);
        
        var userAvatars = '';
        if (allUserNames.length > 0) {
            userAvatars = allUserNames.slice(0, 3).map((userName) => 
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

        // FIXED: Use formatted date
        var endDate = formatDate(p.EndDate);

        $("#projectsGrid").append(`
            <div class="project-card" data-project="${p.Id}" data-users="${allUserNames.join(",")}">
                <a href="#" class="history-btn" data-project="${p.Id}"><i class="bi bi-clock-history"></i></a>
                <div class="project-priority ${statusName.toLowerCase().replace(" ", "-")}">${statusName}</div>
                <div class="project-title">${projectName}</div>
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
                        allUserNames.length > 3
                          ? `<div class="team-count">+${allUserNames.length - 3} more</div>`
                          : allUserNames.length > 0
                          ? `<div class="team-count">${allUserNames.length} members</div>`
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
    
    // FIXED: Use formatted dates
    $("#v-startdate").text(formatDate(project.startingDate) || "N/A");
    
    $("#v-assignedby").text(project.assignedBy || "N/A");

    var allUserNames = getAllProjectUsers(project);
    $("#v-users").text(allUserNames.length ? allUserNames.join(", ") : "No users assigned");
    $("#v-teamsize").text(allUserNames.length + " Member" + (allUserNames.length !== 1 ? "s" : ""));
    $("#v-desc").text(project.description || "No Description / Requirements");

    var tasksContainer = $("#v-tasks-container").empty();
    
    // FIXED: Always get tasks even for completed projects
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
      
      // Handle multiple assigned users properly
      var assignedUsers = [];
      if (t.assignedUser) assignedUsers.push(t.assignedUser);
      if (t.assignedUsers) {
        var usersArray = Array.isArray(t.assignedUsers) ? t.assignedUsers 
          : typeof t.assignedUsers === "string" ? t.assignedUsers.split(",").map(x => x.trim())
          : t.assignedUsers.$values || [];
        assignedUsers = assignedUsers.concat(usersArray);
      }
      
      // Remove duplicates and filter out empty values
      assignedUsers = [...new Set(assignedUsers.filter(u => u && u !== "N/A"))];
      
      var userDisplay = assignedUsers.length > 0 ? assignedUsers.join(", ") : "Unassigned";
      
      // Create separate small avatars for each user
      var userAvatars = assignedUsers.length > 0 
        ? assignedUsers.map(user => 
            `<div class="task-user-avatar-small" title="${user}">${user.substring(0, 2).toUpperCase()}</div>`
          ).join('')
        : '<div class="task-user-avatar-small" title="Unassigned">US</div>';

      // FIXED: Use formatted dates for task dates
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

    var allUserNames = getAllProjectUsers(project);
    $("#project-info .project-users").text(allUserNames.length ? "Assigned Users: " + allUserNames.join(", ") : "No users assigned");

    var $list = $("#team-task-list").empty();
    
    // FIXED: Always get tasks even for completed projects
    var tasks = projectTasksCache[project.Id] || normalizeTasksArray(project.tasks || []);
    var acceptedSet = new Set(toArrayAccepts(project.acceptedTasks || []).map(String));

    if (!tasks.length) {
      $list.append('<li class="list-group-item">No tasks assigned.</li>');
      return;
    }

    tasks.forEach(t => {
      var taskId = String(taskIdOf(t)), isAccepted = acceptedSet.has(taskId);
      var status = parseInt(t.status || t.Status || 0);
      
      // Handle multiple assigned users properly
      var assignedUsers = [];
      if (t.assignedUser) assignedUsers.push(t.assignedUser);
      if (t.assignedUsers) {
        var usersArray = Array.isArray(t.assignedUsers) ? t.assignedUsers 
          : typeof t.assignedUsers === "string" ? t.assignedUsers.split(",").map(x => x.trim())
          : t.assignedUsers.$values || [];
        assignedUsers = assignedUsers.concat(usersArray);
      }
      
      // Remove duplicates and filter out empty values
      assignedUsers = [...new Set(assignedUsers.filter(u => u && u !== "N/A"))];
      
      var userDisplay = assignedUsers.length > 0 ? assignedUsers.join(", ") : "Unassigned";
      
      // Create separate small avatars for each user
      var userAvatars = assignedUsers.length > 0 
        ? assignedUsers.map(user => 
            `<div class="member-avatar-small" title="${user}">${user.substring(0, 2).toUpperCase()}</div>`
          ).join('')
        : '<div class="member-avatar-small" title="Unassigned">US</div>';

      // FIXED: Use formatted dates
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
      
      // FIXED: Always show status for completed tasks, don't hide them
      if (status === 3) {
        $statusContainer.append('<span class="badge bg-success">Completed</span>');
      } else if (isAccepted) {
        $statusContainer.append('<span class="badge bg-primary">Accepted</span>');
      } else {
        // For multiple users, show accept button for each user only if task is not completed
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
    console.log("Project data:", project); // Debug log
    $("#v-status-badge").text(project.statusName || "Unknown")
        .attr("class", `status-badge status-${(project.statusName || "unknown")
        .toLowerCase().replace(/\s/g, "")}`);

    $("#history-project-name").text(project.projectName || "N/A");
    $("#history-project-dept").text(project.departmentName || "N/A");
    
    // FIXED: Use formatted dates
    $("#history-project-start").text(formatDate(project.startingDate) || "N/A");
let deadline =
    project.tasks?.$values?.length
        ? project.tasks.$values
            .map(t => t.dueDate)
            .filter(d => d)
            .sort((a, b) => new Date(a) - new Date(b))
            .pop()
        : null;

$("#history-project-deadline").text(formatDate(deadline) || "N/A");


    

    var allUserNames = getAllProjectUsers(project);
    $("#history-project-users").text(
        allUserNames.length ? "Assigned Users: " + allUserNames.join(", ") : "No users assigned"
    );

    // FIXED: Better task retrieval with fallbacks
    const uniqueTasks = projectTasksCache[project.Id] || 
                       normalizeTasksArray(project.tasks || []) || 
                       [];

    console.log("Tasks found:", uniqueTasks); // Debug log

    const acceptedSet = new Set(toArrayAccepts(project.acceptedTasks || []).map(String));

    const $taskList = $("#history-task-list").empty();

    // Add filter dropdown if it doesn't exist
    if ($("#taskFilter").length === 0) {
        $("#history-task-list").before(`
            <div class="d-flex justify-content-end mb-2">
                <select id="taskFilter" class="form-select form-select-sm" style="width: auto;">
                    <option value="all">All Tasks</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="completed">Completed</option>
                </select>
            </div>
        `);
    }

    function renderTasks(filter = "all") {
        $taskList.empty();

        if (!uniqueTasks || uniqueTasks.length === 0) {
            $taskList.append(`
                <div class="text-center text-muted py-4">
                    <i class="bi bi-inbox mb-2"></i><br>
                    No tasks found for this project
                </div>
            `);
            return;
        }

        let filtered = uniqueTasks.filter(t => {
            if (!t) return false;
            
            const taskId = taskIdOf(t);
            const isAccepted = acceptedSet.has(String(taskId));
            const isCompleted = parseInt(t.status || t.Status || t.taskStatus || 0) === 3;

            if (filter === "pending") return !isAccepted && !isCompleted;
            if (filter === "accepted") return isAccepted && !isCompleted;
            if (filter === "completed") return isCompleted;
            return true; // all
        });

        if (!filtered.length) {
            $taskList.append(`
                <div class="text-center text-muted py-4">
                    <i class="bi bi-inbox mb-2"></i><br>
                    No ${filter} tasks found
                </div>
            `);
            return;
        }

        filtered.forEach(t => {
            if (!t) return;
            
            const taskId = String(taskIdOf(t));
            const isAccepted = acceptedSet.has(taskId);
            const isCompleted = parseInt(t.status || t.Status || t.taskStatus || 0) === 3;

            const status = isCompleted ? "Completed" : isAccepted ? "Accepted" : "Pending";
            const badgeClass =
                isCompleted ? "bg-success" :
                isAccepted ? "bg-primary" :
                "bg-warning";

            // FIXED: Better user assignment handling
            var assignedUsers = [];
            
            // Check multiple possible properties for assigned users
            if (t.assignedUser && t.assignedUser !== "N/A") assignedUsers.push(t.assignedUser);
            if (t.assignedTo && t.assignedTo !== "N/A") assignedUsers.push(t.assignedTo);
            if (t.AssignedUser && t.AssignedUser !== "N/A") assignedUsers.push(t.AssignedUser);
            
            if (t.assignedUsers) {
                var usersArray = [];
                if (Array.isArray(t.assignedUsers)) {
                    usersArray = t.assignedUsers;
                } else if (typeof t.assignedUsers === "string") {
                    usersArray = t.assignedUsers.split(",").map(x => x.trim());
                } else if (t.assignedUsers.$values) {
                    usersArray = t.assignedUsers.$values;
                }
                assignedUsers = assignedUsers.concat(usersArray);
            }
            
            // Remove duplicates and filter out empty values
            assignedUsers = [...new Set(assignedUsers.filter(u => u && u !== "N/A" && u !== ""))];
            
            var userDisplay = assignedUsers.length > 0 ? assignedUsers.join(", ") : "Unassigned";
            
            // Create avatars for users
            var userAvatars = assignedUsers.length > 0 
              ? assignedUsers.map(user => 
                  `<div class="history-member-avatar-small" title="${user}">${user.substring(0, 2).toUpperCase()}</div>`
                ).join('')
              : '<div class="history-member-avatar-small" title="Unassigned">NA</div>';

            // FIXED: Better date handling with multiple possible property names
            var startingDate = formatDate(project.startingDate || project.StartDate);
            var assignedDate = formatDate(t.assignedDate || t.AssignedDate || t.createdDate);
            var completedDate = formatDate(t.completedDate || t.CompletedDate);
            var dueDate = formatDate(t.dueDate || t.DueDate);

            // FIXED: Better task title handling
            var taskTitle = t.title || t.TaskName || t.taskName || t.Name || "Untitled Task";
            var assignedBy = t.assignedBy || t.AssignedBy || "N/A";
            var taskDescription = t.description || t.Description || "No description provided";

            $taskList.append(`
                <div class="card border-0 shadow-sm mb-3">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between mb-2">
                            <h6 class="fw-semibold mb-0" style="font-size: 0.9rem;">
                                ${taskTitle}
                            </h6>
                            <span class="badge ${badgeClass}">${status}</span>
                        </div>

                        <div class="d-flex align-items-center gap-2 mb-2">
                            <div class="history-member-avatars-container">${userAvatars}</div>
                            <div>
                                <div class="fw-medium" style="font-size: 0.95rem;">
                                    ${userDisplay}
                                </div>
                                <small class="text-muted">Assigned by ${assignedBy}</small>
                            </div>
                        </div>

                        ${taskDescription && taskDescription !== "No description provided" ? `
                            <div class="small text-muted mb-2">
                                <strong>Description:</strong> ${taskDescription}
                            </div>
                        ` : ''}

                        <div class="small text-muted mt-2">
                            <div><i class="bi bi-folder2-open me-1"></i> Project Created: ${startingDate || "—"}</div>
                            <div><i class="bi bi-person-plus me-1"></i> Task Assigned: ${assignedDate || "—"}</div>
                            ${isAccepted ? `<div><i class="bi bi-check2-circle me-1"></i> Task Accepted</div>` : ""}
                            ${isCompleted ? `<div><i class="bi bi-flag me-1"></i> Task Completed: ${completedDate || "—"}</div>` : ""}
                        </div>

                        ${dueDate && dueDate !== "N/A" ? `
                            <div class="d-flex align-items-center text-muted small mt-2">
                                <i class="bi bi-calendar-event me-1"></i>
                                Due: ${dueDate}
                            </div>
                        ` : ""}
                    </div>
                </div>
            `);
        });
    }

    $("#taskFilter").off("change").on("change", function () {
        renderTasks($(this).val());
    });

    // render initial
    renderTasks("all");
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