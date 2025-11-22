using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace TaskManagement.Models.GlobalData
{
    public static class GlobalUserData
    {
        public static List<ApiUserDto> globalUserList { get; set; } = new List<ApiUserDto>();

        public static DateTime? LastLoadedTime { get; set; } = DateTime.MinValue;

        public static List<RolePermessionDto> globalRolePermessionList { get; set; } = new List<RolePermessionDto>();
    }
}
