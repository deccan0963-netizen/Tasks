using System;
using System.Collections.Generic;

namespace TaskManagement.Models.GlobalData
{
    public static class GlobalDeptData
    {
        public static List<ApiDeptDto> globalDeptList { get; set; }

        public static DateTime? LastLoadedTime { get; set; }
    }
}
