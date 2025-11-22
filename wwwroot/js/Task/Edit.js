/* Edit.js - client logic for Edit Task page
   Requires:
   - jQuery
   - Select2
   - window.taskEditModel (populated in the Razor view)
*/
(function ($) {
  $(function () {
    var model = window.taskEditModel || {};
    var selectedProjects = model.selectedProjects || [];
    var selectedUsers = model.selectedUsers || [];
    var initialDept = model.initialDept || "";
    var urls = model.urls || {};

    // Initialize Select2 if available
    if ($.fn && $.fn.select2) {
      $("#Department, #Projects, #assignedUser").select2({ width: "100%" });
    }

    function loadProjects(dept) {
      if (!dept) {
        $("#Projects").empty().trigger("change");
        return;
      }

      $.getJSON(urls.getProjects, { department: dept })
        .done(function (res) {
          var $projects = $("#Projects");
          $projects.empty();

          if (res && res.success && Array.isArray(res.data)) {
            res.data.forEach(function (p) {
              $projects.append($("<option>", { value: p.id, text: p.text }));
            });
          } else if (Array.isArray(res)) {
            // fallback if server returns array
            res.forEach(function (p) {
              var val = p.id || p.value || p.ProjectName || p;
              var text = p.text || p.ProjectName || p.name || p;
              $projects.append($("<option>", { value: val, text: text }));
            });
          } else {
            alert(
              "Error loading projects: " +
                (res && res.errors ? res.errors.join(", ") : "Unknown error")
            );
          }

          $projects.trigger("change");

          // Map selectedProjects (which might be ids or names) to option values (prefer ids)
          if (
            selectedProjects &&
            selectedProjects.length &&
            res &&
            Array.isArray(res.data)
          ) {
            var matchedIds = [];
            selectedProjects.forEach(function (sp) {
              res.data.forEach(function (d) {
                if (d.id == sp || d.text == sp) {
                  if (matchedIds.indexOf(d.id) === -1) matchedIds.push(d.id);
                }
              });

              // Also try to match existing DOM options (in case server returned different shape)
              var opt = $projects
                .find("option")
                .filter(function () {
                  return $(this).val() == sp || $(this).text() == sp;
                })
                .first();

              if (opt.length && matchedIds.indexOf(opt.val()) === -1) {
                matchedIds.push(opt.val());
              }
            });

            if (matchedIds.length) {
              $projects.val(matchedIds).trigger("change");
            }
          }
        })
        .fail(function () {
          alert("Unexpected error loading projects.");
        });
    }

    function loadUsers(dept) {
      if (!dept) {
        $("#assignedUser").empty().trigger("change");
        return;
      }

      $.getJSON(urls.getUsers, { department: dept })
        .done(function (res) {
          var $users = $("#assignedUser");
          $users.empty();

          if (res && res.success && Array.isArray(res.data)) {
            res.data.forEach(function (u) {
              $users.append($("<option>", { value: u.id, text: u.text }));
            });
          } else if (Array.isArray(res)) {
            res.forEach(function (u) {
              var val = u.id || u.userName || u;
              var text = u.userName || u.name || u;
              $users.append($("<option>", { value: val, text: text }));
            });
          } else {
            alert(
              "Error loading users: " +
                (res && res.errors ? res.errors.join(", ") : "Unknown error")
            );
          }

          $users.trigger("change");

          if (
            selectedUsers &&
            selectedUsers.length &&
            res &&
            Array.isArray(res.data)
          ) {
            var matchedIds = [];
            selectedUsers.forEach(function (su) {
              res.data.forEach(function (d) {
                if (d.id == su || d.text == su) {
                  if (matchedIds.indexOf(d.id) === -1) matchedIds.push(d.id);
                }
              });

              var opt = $users
                .find("option")
                .filter(function () {
                  return $(this).val() == su || $(this).text() == su;
                })
                .first();

              if (opt.length && matchedIds.indexOf(opt.val()) === -1) {
                matchedIds.push(opt.val());
              }
            });

            if (matchedIds.length) {
              $users.val(matchedIds).trigger("change");
            }
          }
        })
        .fail(function () {
          alert("Unexpected error loading users.");
        });
    }

    // Department change handler
    $("#Department").on("change", function () {
      var dept = $(this).val();
      if (!dept) {
        $("#Projects, #assignedUser").empty().val(null).trigger("change");
        return;
      }
      loadProjects(dept);
      loadUsers(dept);
      // Clear selections on department change (preselection only on initial load)
      $("#Projects, #assignedUser").val(null).trigger("change");
    });

    // Initial load if department preselected
    if (initialDept) {
      // set the select value and trigger change (this will call loadProjects/loadUsers)
      $("#Department").val(initialDept).trigger("change");
      loadProjects(initialDept);
      loadUsers(initialDept);
    }

    // Submit handler
    $("#editTaskForm").on("submit", function (e) {
      e.preventDefault();

      if (!$("#Department").val()) {
        $("#department-error").text("Department is required.");
        return;
      }
      $("#department-error").text("");

      var data = {
        Id: $("input[name='Id']").val(),
        TaskName: $("input[name='TaskName']").val().trim(),
        Department: $("#Department").val(),
        SelectedProjects: $("#Projects").val() || [],
        SelectedUserNames: $("#assignedUser").val() || [],
        DueDate: $("input[name='DueDate']").val(),
        Status: $("select[name='Status']").val(),
        Description: $("textarea[name='Description']").val().trim(),
      };

      if (!data.TaskName) {
        Swal.fire("Validation Error", "Task Name is required.", "warning");
        return;
      }
      if (!data.Department) {
        Swal.fire("Validation Error", "Department is required.", "warning");
        return;
      }

      $.ajax({
        url: urls.editPost,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(data),
        headers: {
          RequestVerificationToken: $(
            'input[name="__RequestVerificationToken"]'
          ).val(),
        },
        success: function (res) {
          if (res && res.success) {
            Swal.fire({
              title: "Updated!",
              text: "Task updated successfully and stored in database.",
              icon: "success",
              confirmButtonText: "OK",
            }).then(function () {
              window.location.href = window.urls.index;
            });
          } else {
            Swal.fire(
              "Error",
              res && res.errors ? res.errors.join(", ") : "Unknown error",
              "error"
            );
          }
        },
        error: function () {
          Swal.fire("Error", "Unexpected error while saving.", "error");
        },
      });
    });
  });
})(jQuery);
