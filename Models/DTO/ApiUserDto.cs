using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace TaskManagement.Models
{
    public class ApiUserDto
    {
        public int id { get; set; }

        public int? bioid { get; set; }
        public string? userName { get; set; }
    }
}
