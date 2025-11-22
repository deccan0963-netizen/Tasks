using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using TaskManagement.Models;
using TaskManagement.Models.GlobalData;

namespace TaskManagement.Service
{
    public class RolePrivilegeService
    {
        private readonly IMemoryCache _cache;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public RolePrivilegeService(
            IMemoryCache memoryCache,
            IHttpContextAccessor httpContextAccessor
        )
        {
            _cache = memoryCache;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<List<RolePermessionDto>> GetRolePrivilegesAsync()
        {
            try
            {
                var user = _httpContextAccessor.HttpContext?.User;

                // If user not authenticated, return empty permissions
                if (user == null || !user.Identity.IsAuthenticated)
                    return new List<RolePermessionDto>();

                // Get role ID from claims (adjust claim name if needed)
                var roleIdClaim = user.FindFirst("role_id")?.Value;
                if (string.IsNullOrEmpty(roleIdClaim))
                    return new List<RolePermessionDto>();

                int roleId = Convert.ToInt32(roleIdClaim);

                // Check cache first
                if (_cache.TryGetValue(roleId, out List<RolePermessionDto> cachedPrivileges))
                    return cachedPrivileges;

                // // Hard-coded permissions (replace with DB/API in future)
                // var privileges = new List<RolePermessionDto>
                // {
                //     new RolePermessionDto
                //     {
                //         PermissionId = 1,
                //         PrimaryActionName = "Project",
                //         SecondaryActionName = "View",
                //         DisplayName = "View Project",
                //     },
                //     new RolePermessionDto
                //     {
                //         PermissionId = 2,
                //         PrimaryActionName = "Project",
                //         SecondaryActionName = "Create",
                //         DisplayName = "Create Project",
                //     },
                //     new RolePermessionDto
                //     {
                //         PermissionId = 3,
                //         PrimaryActionName = "Project",
                //         SecondaryActionName = "Edit",
                //         DisplayName = "Edit Project",
                //     },
                //     new RolePermessionDto
                //     {
                //         PermissionId = 4,
                //         PrimaryActionName = "Project",
                //         SecondaryActionName = "Delete",
                //         DisplayName = "Delete Project",
                //     },
                //     new RolePermessionDto
                //     {
                //         PermissionId = 5,
                //         PrimaryActionName = "Task",
                //         SecondaryActionName = "View",
                //         DisplayName = "View Task",
                //     },
                //     new RolePermessionDto
                //     {
                //         PermissionId = 6,
                //         PrimaryActionName = "Task",
                //         SecondaryActionName = "Create",
                //         DisplayName = "Create Task",
                //     },
                //     new RolePermessionDto
                //     {
                //         PermissionId = 7,
                //         PrimaryActionName = "Task",
                //         SecondaryActionName = "Edit",
                //         DisplayName = "Edit Task",
                //     },
                //     new RolePermessionDto
                //     {
                //         PermissionId = 8,
                //         PrimaryActionName = "Task",
                //         SecondaryActionName = "Delete",
                //         DisplayName = "Delete Task",
                //     },
                //     new RolePermessionDto
                //     {
                //         PermissionId = 9,
                //         PrimaryActionName = "ManageTasks",
                //         SecondaryActionName = "View",
                //         DisplayName = "View Manage Tasks",
                //     },
                //     new RolePermessionDto
                //     {
                //         PermissionId = 10,
                //         PrimaryActionName = "ManageTasks",
                //         SecondaryActionName = "Edit",
                //         DisplayName = "Edit Manage Tasks",
                //     },
                // };

                var privileges = GlobalUserData.globalRolePermessionList;
                
                // Cache the permissions for 30 minutes
                _cache.Set(
                    roleId,
                    privileges,
                    new MemoryCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30),
                    }
                );

                return await Task.FromResult(privileges);
            }
            catch
            {
                return new List<RolePermessionDto>();
            }
        }
    }
}
