"use client";

import { useState } from "react";
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
} from "lucide-react";

// Mock data - replace with your API calls
const mockData = {
  workspaces: [
    { _id: "1", name: "Marketing Team", countBoard: 5, members: [{}, {}, {}] },
    { _id: "2", name: "Development", countBoard: 8, members: [{}, {}, {}, {}] },
    { _id: "3", name: "Design Studio", countBoard: 3, members: [{}, {}] },
  ],
  boards: [
    { _id: "1", name: "Q4 Campaign" },
    { _id: "2", name: "Website Redesign" },
    { _id: "3", name: "Mobile App" },
  ],
  tasks: [
    {
      _id: "1",
      title: "Design Homepage",
      progress: 75,
      assignedTo: { name: "John Doe", email: "john@example.com" },
    },
    {
      _id: "2",
      title: "API Integration",
      progress: 45,
      assignedTo: { name: "Jane Smith", email: "jane@example.com" },
    },
    {
      _id: "3",
      title: "User Testing",
      progress: 90,
      assignedTo: { name: "Mike Johnson", email: "mike@example.com" },
    },
    { _id: "4", title: "Content Creation", progress: 30, assignedTo: null },
  ],
  users: [
    {
      _id: "1",
      name: "John Doe",
      email: "john@example.com",
      role: "Admin",
      status: "active",
    },
    {
      _id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "Member",
      status: "active",
    },
    {
      _id: "3",
      name: "Mike Johnson",
      email: "mike@example.com",
      role: "Member",
      status: "pending",
    },
  ],
};

export default function Dashboard() {
  const [selectedWorkspace, setSelectedWorkspace] = useState(
    mockData.workspaces[0]
  );
  const [activeTab, setActiveTab] = useState("overview");

  // Calculate statistics
  const totalTasks = mockData.tasks.length;
  const completedTasks = mockData.tasks.filter(
    (task) => task.progress === 100
  ).length;
  const averageProgress = Math.round(
    mockData.tasks.reduce((sum, task) => sum + task.progress, 0) / totalTasks
  );
  const activeUsers = mockData.users.filter(
    (user) => user.status === "active"
  ).length;

  const getInitials = (name) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "?";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back! Here's what's happening with your projects.
            </p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-md bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">
                    Total Workspaces
                  </p>
                  <p className="text-3xl font-bold">
                    {mockData.workspaces.length}
                  </p>
                </div>
                <FolderOpen className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">
                    Active Tasks
                  </p>
                  <p className="text-3xl font-bold">{totalTasks}</p>
                </div>
                <CheckSquare className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">
                    Team Members
                  </p>
                  <p className="text-3xl font-bold">{activeUsers}</p>
                </div>
                <Users className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">
                    Avg Progress
                  </p>
                  <p className="text-3xl font-bold">{averageProgress}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Workspaces & Boards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Workspaces */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Your Workspaces
                </CardTitle>
                <CardDescription>
                  Manage and switch between your workspaces
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mockData.workspaces.map((workspace) => (
                    <Card
                      key={workspace._id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedWorkspace._id === workspace._id
                          ? "ring-2 ring-blue-500 bg-blue-50"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedWorkspace(workspace)}
                    >
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-gray-900">
                          {workspace.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <CheckSquare className="h-4 w-4" />
                            {workspace.countBoard} boards
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {workspace.members.length} members
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tasks Overview */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Task Progress
                </CardTitle>
                <CardDescription>
                  Track progress across all your tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockData.tasks.map((task) => (
                    <div
                      key={task._id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            {task.title}
                          </h4>
                          <span className="text-sm font-medium text-gray-600">
                            {task.progress}%
                          </span>
                        </div>
                        <Progress value={task.progress} className="h-2" />
                      </div>
                      {task.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(task.assignedTo.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-600 hidden sm:block">
                            {task.assignedTo.name}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline">Unassigned</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Team & Quick Actions */}
          <div className="space-y-6">
            {/* Team Members */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  {selectedWorkspace.name} workspace
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockData.users.map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          {user.email}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant={
                            user.role === "Admin" ? "default" : "secondary"
                          }
                        >
                          {user.role}
                        </Badge>
                        <div
                          className={`w-2 h-2 rounded-full ${getStatusColor(
                            user.status
                          )}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4 bg-transparent"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Completed Tasks</span>
                  <span className="font-semibold">
                    {completedTasks}/{totalTasks}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Boards</span>
                  <span className="font-semibold">
                    {mockData.boards.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Team Productivity
                  </span>
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    High
                  </Badge>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">
                      Overall Progress
                    </span>
                    <span className="text-sm font-medium">
                      {averageProgress}%
                    </span>
                  </div>
                  <Progress value={averageProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
