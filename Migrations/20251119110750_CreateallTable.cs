using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TaskManagement.Migrations
{
    /// <inheritdoc />
    public partial class CreateallTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TB_TASK_ACCEPTANCE",
                columns: table => new
                {
                    ID = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TASK_ID = table.Column<int>(type: "integer", nullable: false),
                    USER_ID = table.Column<string>(type: "text", nullable: false),
                    ACCEPTED_DATE = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CREATEDBY = table.Column<int>(type: "integer", nullable: true),
                    UPDATEDBY = table.Column<int>(type: "integer", nullable: true),
                    CREATEDTIME = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UPDATEDTIME = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IS_DELETED = table.Column<string>(type: "varchar(1)", nullable: false),
                    IS_DISABLED = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TB_TASK_ACCEPTANCE", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "TB_TASK_PROJECTS",
                columns: table => new
                {
                    ID = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PROJECT_ID = table.Column<int>(type: "integer", nullable: false),
                    LOCATION = table.Column<int>(type: "integer", nullable: false),
                    DEPARTMENT = table.Column<int>(type: "integer", nullable: false),
                    ASSIGNED_USERS = table.Column<string>(type: "text", nullable: false),
                    ASSIGNED_BY = table.Column<string>(type: "text", nullable: false),
                    CLIENT = table.Column<string>(type: "text", nullable: false),
                    START_DATE = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    END_DATE = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DESCRIPTION = table.Column<string>(type: "text", nullable: false),
                    STATUS = table.Column<int>(type: "integer", nullable: false),
                    CREATEDBY = table.Column<int>(type: "integer", nullable: true),
                    UPDATEDBY = table.Column<int>(type: "integer", nullable: true),
                    CREATEDTIME = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UPDATEDTIME = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IS_DELETED = table.Column<string>(type: "varchar(1)", nullable: false),
                    IS_DISABLED = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TB_TASK_PROJECTS", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "TB_TASKS",
                columns: table => new
                {
                    ID = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TASK_NAME = table.Column<string>(type: "text", nullable: false),
                    DEPARTMENT = table.Column<int>(type: "integer", nullable: false),
                    PROJECT_ID = table.Column<int>(type: "integer", nullable: false),
                    ASSIGNED_USERS = table.Column<string>(type: "text", nullable: false),
                    ASSIGNED_BY = table.Column<string>(type: "text", nullable: false),
                    DUE_DATE = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    COMPLETED_DATE = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DESCRIPTION = table.Column<string>(type: "text", nullable: false),
                    STATUS = table.Column<int>(type: "integer", nullable: false),
                    CREATEDBY = table.Column<int>(type: "integer", nullable: true),
                    UPDATEDBY = table.Column<int>(type: "integer", nullable: true),
                    CREATEDTIME = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UPDATEDTIME = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IS_DELETED = table.Column<string>(type: "varchar(1)", nullable: false),
                    IS_DISABLED = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TB_TASKS", x => x.ID);
                    table.ForeignKey(
                        name: "FK_TB_TASKS_TB_TASK_PROJECTS_PROJECT_ID",
                        column: x => x.PROJECT_ID,
                        principalTable: "TB_TASK_PROJECTS",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TB_TASKS_PROJECT_ID",
                table: "TB_TASKS",
                column: "PROJECT_ID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TB_TASK_ACCEPTANCE");

            migrationBuilder.DropTable(
                name: "TB_TASKS");

            migrationBuilder.DropTable(
                name: "TB_TASK_PROJECTS");
        }
    }
}
