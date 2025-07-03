"use client";

import { useState, useEffect } from "react";
import { useCommon } from "../../contexts/CommonContext";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart3,
  Users,
  FolderOpen,
  CheckSquare,
  Plus,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronRight,
  List,
  ChevronLeft,
} from "lucide-react";
import InviteMemberModal from "../workspaces/InviteMemberWorkspace";

const Dashboard = () => {
  const { apiBaseUrl, accessToken } = useCommon();

  // Data state
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  // Current user & role
  const stored = localStorage.getItem("userData");
  const currentUserId = stored ? JSON.parse(stored)._id : null;
  const [currentUserRole, setCurrentUserRole] = useState(null);

  // Loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [expandedSections, setExpandedSections] = useState({
    workspaces: true,
    boards: true,
    lists: false,
    tasks: true,
    users: false,
  });
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Pagination state
  const [workspacePage, setWorkspacePage] = useState(1);
  const [boardPage, setBoardPage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  // Helpers
  const getDisplayName = (user) =>
    user.fullname || user.username || user.name || user.email || "Unknown";

  const getInitials = (user) => {
    const name = getDisplayName(user);
    return user.initials || name.charAt(0).toUpperCase();
  };

  const getUserStatusVariant = (status) => {
    const s = status?.toLowerCase() || "active";
    switch (s) {
      case "active":
      case "accepted":
        return "default";
      case "pending":
        return "secondary";
      case "declined":
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Invite permission
  const canInvite =
    currentUserRole === "creatorWorkspace" ||
    currentUserRole === "adminWorkspace";

  useEffect(() => {
    if (users.length && currentUserId) {
      const me = users.find((u) => u._id === currentUserId);
      setCurrentUserRole(me?.role || null);
    }
  }, [users, currentUserId]);

  // Pagination helpers
  const ITEMS_PER_PAGE = 4; // Reduced from 6 to 4 for better spacing
  const TASKS_PER_PAGE = 3; // Limit tasks to 3 per page
  const USERS_PER_PAGE = 3; // Limit users to 3 per page

  const totalWorkspacePages =
    Math.ceil(workspaces.length / ITEMS_PER_PAGE) || 1;
  const totalBoardPages = Math.ceil(boards.length / ITEMS_PER_PAGE) || 1;
  const totalTaskPages = Math.ceil(tasks.length / TASKS_PER_PAGE) || 1;
  const totalUserPages = Math.ceil(users.length / USERS_PER_PAGE) || 1;

  const paginatedWorkspaces = workspaces.slice(
    (workspacePage - 1) * ITEMS_PER_PAGE,
    workspacePage * ITEMS_PER_PAGE
  );
  const paginatedBoards = boards.slice(
    (boardPage - 1) * ITEMS_PER_PAGE,
    boardPage * ITEMS_PER_PAGE
  );
  const paginatedTasks = tasks.slice(
    (taskPage - 1) * TASKS_PER_PAGE,
    taskPage * TASKS_PER_PAGE
  );
  const paginatedUsers = users.slice(
    (userPage - 1) * USERS_PER_PAGE,
    userPage * USERS_PER_PAGE
  );

  // Pagination handlers
  const handleWorkspacePageChange = (newPage) => {
    setWorkspacePage(Math.max(1, Math.min(newPage, totalWorkspacePages)));
  };

  const handleBoardPageChange = (newPage) => {
    setBoardPage(Math.max(1, Math.min(newPage, totalBoardPages)));
  };

  const handleTaskPageChange = (newPage) => {
    setTaskPage(Math.max(1, Math.min(newPage, totalTaskPages)));
  };

  const handleUserPageChange = (newPage) => {
    setUserPage(Math.max(1, Math.min(newPage, totalUserPages)));
  };

  // Fetch workspaces
  useEffect(() => {
    const fetchWorkspaces = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${apiBaseUrl}/workspace`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setWorkspaces(data.data || []);
        if (data.data?.length) setSelectedWorkspace(data.data[0]);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch workspaces.");
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspaces();
  }, [apiBaseUrl, accessToken]);

  // Fetch boards
  useEffect(() => {
    if (!selectedWorkspace) return;
    const fetchBoards = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${apiBaseUrl}/workspace/${selectedWorkspace._id}/board`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        setBoards(data.boards || []);
        if (data.boards?.length) setSelectedBoard(data.boards[0]);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch boards.");
      } finally {
        setLoading(false);
      }
    };
    fetchBoards();
    setWorkspacePage(1);
    setBoardPage(1);
    setTaskPage(1);
  }, [selectedWorkspace, apiBaseUrl, accessToken]);

  // Fetch lists
  useEffect(() => {
    if (!selectedBoard) return;
    const fetchLists = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${apiBaseUrl}/list`, {
          params: { boardId: selectedBoard._id },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setLists(data.data || []);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch lists.");
      } finally {
        setLoading(false);
      }
    };
    fetchLists();
    setBoardPage(1);
    setTaskPage(1);
  }, [selectedBoard, apiBaseUrl, accessToken]);

  // Fetch tasks
  useEffect(() => {
    if (!selectedBoard) return;
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${apiBaseUrl}/task/get-by-board/${selectedBoard._id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        setTasks(data.data || []);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch tasks.");
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
    setTaskPage(1);
  }, [selectedBoard, apiBaseUrl, accessToken]);

  // Fetch users
  useEffect(() => {
    if (!selectedWorkspace) return;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${apiBaseUrl}/workspace/${selectedWorkspace._id}/users`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        setUsers(data.users || []);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch users.");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
    setUserPage(1);
  }, [selectedWorkspace, apiBaseUrl, accessToken]);

  // Handlers
  const toggleSection = (section) =>
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));

  const handleWorkspaceSelect = (ws) => {
    setSelectedWorkspace(ws);
    setBoards([]);
    setSelectedBoard(null);
    setLists([]);
    setTasks([]);
    setWorkspacePage(1);
    setBoardPage(1);
    setTaskPage(1);
  };

  const handleBoardSelect = (b) => {
    setSelectedBoard(b);
    setLists([]);
    setTasks([]);
    setBoardPage(1);
    setTaskPage(1);
  };

  // Calculate statistics
  const overallProgress = tasks.length
    ? Number.parseFloat(
        (
          tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length
        ).toFixed(2)
      )
    : 0;

  const completedTasks = tasks.filter(
    (task) => (task.progress || 0) === 100
  ).length;
  const activeUsers = users.filter(
    (user) => user.status === "active" || user.status === "accepted"
  ).length;

  // Pagination component
  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    label,
  }) => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-3 px-2">
        <span className="text-xs text-gray-500">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  if (loading)
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center ml-[200px] mt-[60px]">
        <div className="text-lg">Loading...</div>
      </div>
    );

  if (error)
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center ml-[200px] mt-[60px]">
        <div className="text-red-600">{error}</div>
      </div>
    );

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Account for 200px fixed menubar on the left and 60px header on top */}
      <div className="ml-[200px] pt-[60px]">
        <div className="p-4 max-w-6xl mx-auto">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 text-sm">
                  {selectedWorkspace
                    ? `Managing ${selectedWorkspace.name}`
                    : "Welcome back! Here's what's happening with your projects."}
                </p>
              </div>
              {canInvite && (
                <Button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 h-9"
                >
                  <Plus className="h-4 w-4" />
                  Invite Member
                </Button>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <Card className="border-0 shadow-md bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-xs font-medium">
                        Total Workspaces
                      </p>
                      <p className="text-xl font-bold">{workspaces.length}</p>
                    </div>
                    <FolderOpen className="h-5 w-5 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-r from-green-500 to-green-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-xs font-medium">
                        Active Tasks
                      </p>
                      <p className="text-xl font-bold">{tasks.length}</p>
                    </div>
                    <CheckSquare className="h-5 w-5 text-green-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-xs font-medium">
                        Team Members
                      </p>
                      <p className="text-xl font-bold">{activeUsers}</p>
                    </div>
                    <Users className="h-5 w-5 text-purple-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-xs font-medium">
                        Avg Progress
                      </p>
                      <p className="text-xl font-bold">{overallProgress}%</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-orange-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Left Column - Workspaces & Boards */}
              <div className="xl:col-span-2 space-y-5">
                {/* Workspaces */}
                <Card className="border-0 shadow-md">
                  <CardHeader
                    className="cursor-pointer hover:bg-gray-50 transition-colors py-3"
                    onClick={() => toggleSection("workspaces")}
                  >
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        Your Workspaces
                        <Badge variant="secondary" className="text-xs">
                          {workspaces.length}
                        </Badge>
                      </div>
                      {expandedSections.workspaces ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Manage and switch between your workspaces
                    </CardDescription>
                  </CardHeader>
                  {expandedSections.workspaces && (
                    <CardContent className="pt-0">
                      {paginatedWorkspaces.length === 0 ? (
                        <p className="text-gray-500 text-center py-4 text-sm">
                          No workspaces available.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {paginatedWorkspaces.map((workspace) => (
                              <Card
                                key={workspace._id}
                                className={`cursor-pointer transition-all hover:shadow-md ${
                                  selectedWorkspace?._id === workspace._id
                                    ? "ring-2 ring-blue-500 bg-blue-50"
                                    : "hover:bg-gray-50"
                                }`}
                                onClick={() => handleWorkspaceSelect(workspace)}
                              >
                                <CardContent className="p-4">
                                  <h3 className="font-semibold text-gray-900 text-sm">
                                    {workspace.name}
                                  </h3>
                                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                                    <span className="flex items-center gap-1">
                                      <CheckSquare className="h-3 w-3" />
                                      {workspace.countBoard || 0} boards
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {Array.isArray(workspace.members)
                                        ? workspace.members.length
                                        : 0}{" "}
                                      members
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                          <PaginationControls
                            currentPage={workspacePage}
                            totalPages={totalWorkspacePages}
                            onPageChange={handleWorkspacePageChange}
                            label="workspaces"
                          />
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>

                {/* Boards */}
                {selectedWorkspace && (
                  <Card className="border-0 shadow-md">
                    <CardHeader
                      className="cursor-pointer hover:bg-gray-50 transition-colors py-3"
                      onClick={() => toggleSection("boards")}
                    >
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4" />
                          {selectedWorkspace.name} - Boards
                          <Badge variant="secondary" className="text-xs">
                            {boards.length}
                          </Badge>
                        </div>
                        {expandedSections.boards ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Boards in your selected workspace
                      </CardDescription>
                    </CardHeader>
                    {expandedSections.boards && (
                      <CardContent className="pt-0">
                        {paginatedBoards.length === 0 ? (
                          <p className="text-gray-500 text-center py-4 text-sm">
                            No boards available.
                          </p>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {paginatedBoards.map((board) => (
                                <Card
                                  key={board._id}
                                  className={`cursor-pointer transition-all hover:shadow-md ${
                                    selectedBoard?._id === board._id
                                      ? "ring-2 ring-blue-500 bg-blue-50"
                                      : "hover:bg-gray-50"
                                  }`}
                                  onClick={() => handleBoardSelect(board)}
                                >
                                  <CardContent className="p-4">
                                    <h3 className="font-semibold text-gray-900 text-sm">
                                      {board.name}
                                    </h3>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                            <PaginationControls
                              currentPage={boardPage}
                              totalPages={totalBoardPages}
                              onPageChange={handleBoardPageChange}
                              label="boards"
                            />
                          </>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Lists */}
                {selectedBoard && (
                  <Card className="border-0 shadow-md">
                    <CardHeader
                      className="cursor-pointer hover:bg-gray-50 transition-colors py-3"
                      onClick={() => toggleSection("lists")}
                    >
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          <List className="h-4 w-4" />
                          {selectedBoard.name} - Lists
                          <Badge variant="secondary" className="text-xs">
                            {lists.length}
                          </Badge>
                        </div>
                        {expandedSections.lists ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Lists in your selected board
                      </CardDescription>
                    </CardHeader>
                    {expandedSections.lists && (
                      <CardContent className="pt-0">
                        {lists.length === 0 ? (
                          <p className="text-gray-500 text-center py-4 text-sm">
                            No lists available.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {lists.map((list) => (
                              <Card
                                key={list._id}
                                className="hover:shadow-md transition-all"
                              >
                                <CardContent className="p-4">
                                  <h3 className="font-semibold text-gray-900 text-sm">
                                    {list.title}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {list.color || "Default"}
                                    </Badge>
                                    <span className="text-xs text-gray-600">
                                      {
                                        tasks.filter(
                                          (t) => t.listId === list._id
                                        ).length
                                      }{" "}
                                      tasks
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Tasks Overview */}
                {selectedBoard && (
                  <Card className="border-0 shadow-md">
                    <CardHeader
                      className="cursor-pointer hover:bg-gray-50 transition-colors py-3"
                      onClick={() => toggleSection("tasks")}
                    >
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Task Progress
                          <Badge variant="secondary" className="text-xs">
                            {tasks.length}
                          </Badge>
                        </div>
                        {expandedSections.tasks ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Track progress across all your tasks
                      </CardDescription>
                    </CardHeader>
                    {expandedSections.tasks && (
                      <CardContent className="pt-0">
                        {paginatedTasks.length === 0 ? (
                          <p className="text-gray-500 text-center py-4 text-sm">
                            No tasks available.
                          </p>
                        ) : (
                          <>
                            <div className="space-y-4">
                              {paginatedTasks.map((task) => (
                                <div
                                  key={task._id}
                                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="font-medium text-gray-900 text-sm">
                                        {task.title || task.name}
                                      </h4>
                                      <span className="text-xs font-medium text-gray-600">
                                        {task.progress || 0}%
                                      </span>
                                    </div>
                                    <Progress
                                      value={task.progress || 0}
                                      className="h-1.5"
                                    />
                                  </div>
                                  {task.assignedTo ? (
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-xs">
                                          {getInitials(task.assignedTo)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs text-gray-600 hidden sm:block">
                                        {getDisplayName(task.assignedTo)}
                                      </span>
                                    </div>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Unassigned
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                            <PaginationControls
                              currentPage={taskPage}
                              totalPages={totalTaskPages}
                              onPageChange={handleTaskPageChange}
                              label="tasks"
                            />
                          </>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )}
              </div>

              {/* Right Column - Team & Quick Actions */}
              <div className="space-y-5">
                {/* Team Members */}
                {selectedWorkspace && (
                  <Card className="border-0 shadow-md">
                    <CardHeader
                      className="cursor-pointer hover:bg-gray-50 transition-colors py-3"
                      onClick={() => toggleSection("users")}
                    >
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Team Members
                          <Badge variant="secondary" className="text-xs">
                            {users.length}
                          </Badge>
                        </div>
                        {expandedSections.users ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {selectedWorkspace.name} workspace
                      </CardDescription>
                    </CardHeader>
                    {expandedSections.users && (
                      <CardContent className="pt-0">
                        {paginatedUsers.length === 0 ? (
                          <p className="text-gray-500 text-center py-4 text-sm">
                            No team members yet.
                          </p>
                        ) : (
                          <>
                            <div className="space-y-3">
                              {paginatedUsers.map((user) => (
                                <div
                                  key={user._id}
                                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {getInitials(user)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate text-xs">
                                      {getDisplayName(user)}
                                    </p>
                                    <p className="text-xs text-gray-600 truncate">
                                      {user.email}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge
                                      variant={
                                        user.role === "creatorWorkspace"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {user.role === "creatorWorkspace"
                                        ? "Creator"
                                        : user.role}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <PaginationControls
                              currentPage={userPage}
                              totalPages={totalUserPages}
                              onPageChange={handleUserPageChange}
                              label="users"
                            />
                          </>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Quick Stats */}
                <Card className="border-0 shadow-md">
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-4 w-4" />
                      Quick Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        Completed Tasks
                      </span>
                      <span className="font-semibold text-sm">
                        {completedTasks}/{tasks.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        Active Boards
                      </span>
                      <span className="font-semibold text-sm">
                        {boards.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Total Lists</span>
                      <span className="font-semibold text-sm">
                        {lists.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        Team Productivity
                      </span>
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-600 text-xs"
                      >
                        {overallProgress > 70
                          ? "High"
                          : overallProgress > 40
                          ? "Medium"
                          : "Low"}
                      </Badge>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">
                          Overall Progress
                        </span>
                        <span className="text-xs font-medium">
                          {overallProgress}%
                        </span>
                      </div>
                      <Progress value={overallProgress} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Invite Modal */}
            {selectedWorkspace && canInvite && (
              <InviteMemberModal
                show={showInviteModal}
                onHide={() => setShowInviteModal(false)}
                workspaceId={selectedWorkspace._id}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
