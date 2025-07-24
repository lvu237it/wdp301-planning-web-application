'use client';

import { useState, useEffect } from 'react';
import { useCommon } from '../../contexts/CommonContext';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  BarChart3,
  Users,
  FolderOpen,
  CheckSquare,
  Plus,
  Activity,
  ChevronDown,
  ChevronRight,
  List,
  ChevronLeft,
  UserPlus,
  Settings,
} from 'lucide-react';
import InviteMemberModal from '../workspaces/InviteMemberWorkspace';

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
  const stored = localStorage.getItem('userData');
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
  const [showMemberManagementModal, setShowMemberManagementModal] =
    useState(false);

  // Pagination state
  const [workspacePage, setWorkspacePage] = useState(1);
  const [boardPage, setBoardPage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  // Helpers with null safety
  const getDisplayName = (user) => {
    if (!user) return 'Unknown';
    return (
      user?.fullname || user?.username || user?.name || user?.email || 'Unknown'
    );
  };

  const getInitials = (user) => {
    if (!user) return '?';
    const name = getDisplayName(user);
    return user?.initials || name.charAt(0).toUpperCase();
  };

  const getUserStatusVariant = (status) => {
    if (!status) return 'outline';
    const s = status.toLowerCase();
    switch (s) {
      case 'active':
      case 'accepted':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'declined':
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Safe member count calculation - count only accepted members
  const getAcceptedMemberCount = (workspace) => {
    if (!workspace || !Array.isArray(workspace.members)) return 0;
    return workspace.members.filter(
      (member) => member && member.invitationStatus === 'accepted'
    ).length;
  };

  // Format percentage to 2 decimal places max
  const formatPercentage = (value) => {
    if (!value && value !== 0) return '0.00';
    return Number(value).toFixed(2);
  };

  // Invite permission with null safety
  const canInvite =
    currentUserRole === 'creatorWorkspace' ||
    currentUserRole === 'adminWorkspace';

  useEffect(() => {
    if (users && users.length && currentUserId) {
      const me = users.find((u) => u && u._id === currentUserId);
      setCurrentUserRole(me?.role || null);
    }
  }, [users, currentUserId]);

  // Pagination helpers
  const ITEMS_PER_PAGE = 4;
  const TASKS_PER_PAGE = 3;
  const USERS_PER_PAGE = 5;

  const totalWorkspacePages =
    Math.ceil((workspaces?.length || 0) / ITEMS_PER_PAGE) || 1;
  const totalBoardPages =
    Math.ceil((boards?.length || 0) / ITEMS_PER_PAGE) || 1;
  const totalTaskPages = Math.ceil((tasks?.length || 0) / TASKS_PER_PAGE) || 1;
  const totalUserPages = Math.ceil((users?.length || 0) / USERS_PER_PAGE) || 1;

  const paginatedWorkspaces = (workspaces || []).slice(
    (workspacePage - 1) * ITEMS_PER_PAGE,
    workspacePage * ITEMS_PER_PAGE
  );
  const paginatedBoards = (boards || []).slice(
    (boardPage - 1) * ITEMS_PER_PAGE,
    boardPage * ITEMS_PER_PAGE
  );

  // ---- New: sort tasks by priority ----
  // 0 = completed (100%), 1 = ongoing (assigned & <100%), 2 = unassigned
  const sortedTasks = (tasks || []).slice().sort((a, b) => {
    const getPriority = (t) => {
      const prog = t?.progress || 0;
      if (prog === 100) return 0;
      if (t?.assignedTo && prog < 100) return 1;
      return 2;
    };
    return getPriority(a) - getPriority(b);
  });

  const paginatedTasks = sortedTasks.slice(
    (taskPage - 1) * TASKS_PER_PAGE,
    taskPage * TASKS_PER_PAGE
  );
  // --------------------------------------

  const paginatedUsers = (users || []).slice(
    (userPage - 1) * USERS_PER_PAGE,
    userPage * USERS_PER_PAGE
  );

  const handleWorkspacePageChange = (newPage) => {
    if (!newPage || newPage < 1 || newPage > totalWorkspacePages) return;
    setWorkspacePage(Math.max(1, Math.min(newPage, totalWorkspacePages)));
  };
  const handleBoardPageChange = (newPage) => {
    if (!newPage || newPage < 1 || newPage > totalBoardPages) return;
    setBoardPage(Math.max(1, Math.min(newPage, totalBoardPages)));
  };
  const handleTaskPageChange = (newPage) => {
    if (!newPage || newPage < 1 || newPage > totalTaskPages) return;
    setTaskPage(Math.max(1, Math.min(newPage, totalTaskPages)));
  };
  const handleUserPageChange = (newPage) => {
    if (!newPage || newPage < 1 || newPage > totalUserPages) return;
    setUserPage(Math.max(1, Math.min(newPage, totalUserPages)));
  };

  // Fetch workspaces with error handling
  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!apiBaseUrl || !accessToken) return;

      setLoading(true);
      try {
        const { data } = await axios.get(`${apiBaseUrl}/workspace`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const workspaceData = data?.data || [];
        setWorkspaces(workspaceData);
        if (workspaceData.length > 0) {
          setSelectedWorkspace(workspaceData[0]);
        }
      } catch (err) {
        console.error('Error fetching workspaces:', err);
        setError('Failed to fetch workspaces.');
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspaces();
  }, [apiBaseUrl, accessToken]);

  // Fetch boards with error handling
  useEffect(() => {
    if (!selectedWorkspace || !apiBaseUrl || !accessToken) return;

    const fetchBoards = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${apiBaseUrl}/workspace/${selectedWorkspace._id}/board`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const boardData = data?.boards || [];
        setBoards(boardData);
        if (boardData.length > 0) {
          setSelectedBoard(boardData[0]);
        }
      } catch (err) {
        console.error('Error fetching boards:', err);
        setError('Failed to fetch boards.');
        setBoards([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBoards();
    setWorkspacePage(1);
    setBoardPage(1);
    setTaskPage(1);
  }, [selectedWorkspace, apiBaseUrl, accessToken]);

  // Fetch lists with error handling
  useEffect(() => {
    if (!selectedBoard || !apiBaseUrl || !accessToken) return;

    const fetchLists = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${apiBaseUrl}/list`, {
          params: { boardId: selectedBoard._id },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setLists(data?.data || []);
      } catch (err) {
        console.error('Error fetching lists:', err);
        setError('Failed to fetch lists.');
        setLists([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLists();
    setBoardPage(1);
    setTaskPage(1);
  }, [selectedBoard, apiBaseUrl, accessToken]);

  // Fetch tasks with error handling
  useEffect(() => {
    if (!selectedBoard || !apiBaseUrl || !accessToken) return;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${apiBaseUrl}/task/get-by-board/${selectedBoard._id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        setTasks(data?.data || []);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError('Failed to fetch tasks.');
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
    setTaskPage(1);
  }, [selectedBoard, apiBaseUrl, accessToken]);

  // Fetch users with error handling
  useEffect(() => {
    if (!selectedWorkspace || !apiBaseUrl || !accessToken) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${apiBaseUrl}/workspace/${selectedWorkspace._id}/users`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        setUsers(data?.users || []);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to fetch users.');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
    setUserPage(1);
  }, [selectedWorkspace, apiBaseUrl, accessToken]);

  // Handlers with null guards
  const toggleSection = (section) => {
    if (!section) return;
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleWorkspaceSelect = (ws) => {
    if (!ws) return;
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
    if (!b) return;
    setSelectedBoard(b);
    setLists([]);
    setTasks([]);
    setBoardPage(1);
    setTaskPage(1);
  };

  // Calculate statistics with null safety
  const overallProgress =
    tasks && tasks.length > 0
      ? Number.parseFloat(
          (
            tasks.reduce((sum, t) => sum + (t?.progress || 0), 0) / tasks.length
          ).toFixed(2)
        )
      : 0;

  const completedTasks = (tasks || []).filter(
    (task) => task && (task.progress || 0) === 100
  ).length;

  // Use the same member counting logic as workspace cards
  const activeUsers = selectedWorkspace
    ? getAcceptedMemberCount(selectedWorkspace)
    : 0;

  // Pagination component
  const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
    if (!currentPage || !totalPages || !onPageChange || totalPages <= 1)
      return null;

    return (
      <div className='flex items-center justify-between mt-3 px-2'>
        <span className='text-xs text-gray-500'>
          Page {currentPage} of {totalPages}
        </span>
        <div className='flex items-center gap-1'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className='h-7 w-7 p-0'
          >
            <ChevronLeft className='h-3 w-3' />
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className='h-7 w-7 p-0'
          >
            <ChevronRight className='h-3 w-3' />
          </Button>
        </div>
      </div>
    );
  };

  if (loading && (!workspaces || workspaces.length === 0)) {
    return (
      <div className='fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center ml-[200px] mt-[60px]'>
        <div className='text-lg'>Loading...</div>
      </div>
    );
  }

  if (error && (!workspaces || workspaces.length === 0)) {
    return (
      <div className='fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center ml-[200px] mt-[60px]'>
        <div className='text-red-600'>{error}</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        selectedWorkspace?.background
          ? 'bg-cover bg-center bg-fixed'
          : 'bg-gradient-to-br from-slate-50 to-slate-100'
      }`}
      style={
        selectedWorkspace?.background
          ? {
              backgroundImage: `url(${selectedWorkspace.background})`,
              backgroundAttachment: 'fixed',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {}
      }
    >
      {/* Account for fixed menubar and header */}
      <div className='ml-[200px] pt-[60px]'>
        <div className='p-4 max-w-6xl mx-auto space-y-6'>
          {/* Header */}
          <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6'>
            <div
              className={`${
                selectedWorkspace?.background
                  ? 'bg-white/90 backdrop-blur-sm rounded-lg p-4'
                  : ''
              }`}
            >
              <h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
              <p className='text-gray-600 text-sm'>
                {selectedWorkspace
                  ? `Managing ${selectedWorkspace.name}`
                  : "Welcome back! Here's what's happening with your projects."}
              </p>
            </div>
            {/* {canInvite && selectedWorkspace && (
              <Button
                onClick={() => selectedWorkspace && setShowInviteModal(true)}
                className="flex items-center gap-2 h-9 bg-white/90 backdrop-blur-sm hover:bg-white/95"
              >
                <Plus className="h-4 w-4" />
                Invite Member
              </Button>
            )} */}
          </div>

          {/* Main Content */}
          <div className='grid grid-cols-1 xl:grid-cols-3 gap-5'>
            {/* Left Column - Main Content */}
            <div className='xl:col-span-2 space-y-5'>
              {/* Your Workspaces */}
              <Card
                className={`border-0 shadow-md ${
                  selectedWorkspace?.background
                    ? 'bg-white/95 backdrop-blur-sm'
                    : ''
                }`}
              >
                <CardHeader
                  className='px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors'
                  onClick={() => toggleSection('workspaces')}
                >
                  <CardTitle className='flex items-center justify-between text-base'>
                    <div className='flex items-center gap-2'>
                      <FolderOpen className='-mt-1 h-4 w-4' />
                      Your Workspaces
                      <Badge variant='secondary' className='text-xs'>
                        {workspaces?.length || 0}
                      </Badge>
                    </div>
                    {expandedSections.workspaces ? (
                      <ChevronDown className='h-4 w-4' />
                    ) : (
                      <ChevronRight className='h-4 w-4' />
                    )}
                  </CardTitle>
                  <CardDescription className='text-xs'>
                    Manage and switch between your workspaces
                  </CardDescription>
                </CardHeader>
                {expandedSections.workspaces && (
                  <CardContent className='p-4'>
                    {!paginatedWorkspaces ||
                    paginatedWorkspaces.length === 0 ? (
                      <p className='text-gray-500 text-center py-4 text-sm'>
                        No workspaces available.
                      </p>
                    ) : (
                      <>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          {paginatedWorkspaces.map((workspace, index) => (
                            <Card
                              key={workspace?._id || index}
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                selectedWorkspace?._id === workspace?._id
                                  ? 'ring-2 ring-blue-500 bg-blue-50'
                                  : 'hover:bg-gray-50'
                              }`}
                              onClick={() => handleWorkspaceSelect(workspace)}
                            >
                              <CardContent className='p-4'>
                                <h3 className='font-semibold text-gray-900 text-sm'>
                                  {workspace?.name || 'Unnamed Workspace'}
                                </h3>
                                <div className='flex items-center gap-3 mt-2 text-xs text-gray-600'>
                                  <span className='flex items-center gap-1'>
                                    <CheckSquare className='h-3 w-3' />
                                    {workspace?.countBoard || 0} boards
                                  </span>
                                  <span className='flex items-center gap-1'>
                                    <Users className='h-3 w-3' />
                                    {getAcceptedMemberCount(workspace)} members
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
                        />
                      </>
                    )}
                  </CardContent>
                )}
              </Card>

              <div className='h-4'></div>

              {/* Boards */}
              {selectedWorkspace && (
                <>
                  <Card
                    className={`border-0 shadow-md ${
                      selectedWorkspace?.background
                        ? 'bg-white/95 backdrop-blur-sm'
                        : ''
                    }`}
                  >
                    <CardHeader
                      className='px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors'
                      onClick={() => toggleSection('boards')}
                    >
                      <CardTitle className='flex items-center justify-between text-base'>
                        <div className='flex items-center gap-2'>
                          <CheckSquare className='-mt-1 h-4 w-4' />
                          {selectedWorkspace?.name || 'Workspace'} - Boards
                          <Badge variant='secondary' className='text-xs'>
                            {boards?.length || 0}
                          </Badge>
                        </div>
                        {expandedSections.boards ? (
                          <ChevronDown className='h-4 w-4' />
                        ) : (
                          <ChevronRight className='h-4 w-4' />
                        )}
                      </CardTitle>
                      <CardDescription className='text-xs'>
                        Boards in your selected workspace
                      </CardDescription>
                    </CardHeader>
                    {expandedSections.boards && (
                      <CardContent className='p-4'>
                        {!paginatedBoards || paginatedBoards.length === 0 ? (
                          <p className='text-gray-500 text-center py-4 text-sm'>
                            No boards available.
                          </p>
                        ) : (
                          <>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                              {paginatedBoards.map((board, index) => (
                                <Card
                                  key={board?._id || index}
                                  className={`cursor-pointer transition-all hover:shadow-md ${
                                    selectedBoard?._id === board?._id
                                      ? 'ring-2 ring-blue-500 bg-blue-50'
                                      : 'hover:bg-gray-50'
                                  }`}
                                  onClick={() => handleBoardSelect(board)}
                                >
                                  <CardContent className='p-4'>
                                    <h3 className='font-semibold text-gray-900 text-sm'>
                                      {board?.name || 'Unnamed Board'}
                                    </h3>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                            <PaginationControls
                              currentPage={boardPage}
                              totalPages={totalBoardPages}
                              onPageChange={handleBoardPageChange}
                            />
                          </>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  <div className='h-4'></div>
                </>
              )}

              {/* Lists */}
              {selectedBoard && (
                <>
                  <Card
                    className={`border-0 shadow-md ${
                      selectedWorkspace?.background
                        ? 'bg-white/95 backdrop-blur-sm'
                        : ''
                    }`}
                  >
                    <CardHeader
                      className='px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors'
                      onClick={() => toggleSection('lists')}
                    >
                      <CardTitle className='flex items-center justify-between text-base'>
                        <div className='flex items-center gap-2'>
                          <List className='-mt-1 h-4 w-4' />
                          {selectedBoard?.name || 'Board'} - Lists
                          <Badge variant='secondary' className='text-xs'>
                            {lists?.length || 0}
                          </Badge>
                        </div>
                        {expandedSections.lists ? (
                          <ChevronDown className='h-4 w-4' />
                        ) : (
                          <ChevronRight className='h-4 w-4' />
                        )}
                      </CardTitle>
                      <CardDescription className='text-xs'>
                        Lists in your selected board
                      </CardDescription>
                    </CardHeader>
                    {expandedSections.lists && (
                      <CardContent className='p-4'>
                        {!lists || lists.length === 0 ? (
                          <p className='text-gray-500 text-center py-4 text-sm'>
                            No lists available.
                          </p>
                        ) : (
                          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                            {lists.map((list, index) => (
                              <Card
                                key={list?._id || index}
                                className='hover:shadow-md transition-all'
                              >
                                <CardContent className='p-4'>
                                  <h3 className='font-semibold text-gray-900 text-sm'>
                                    {list?.title || 'Unnamed List'}
                                  </h3>
                                  <div className='flex items-center gap-2 mt-2 text-xs text-gray-600'>
                                    <Badge variant='outline'>
                                      {list?.color || 'Default'}
                                    </Badge>
                                    {
                                      (tasks || []).filter(
                                        (t) => t && t.listId === list?._id
                                      ).length
                                    }{' '}
                                    tasks
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  <div className='h-4'></div>
                </>
              )}

              {/* Tasks Overview */}
              {selectedBoard && (
                <Card
                  className={`border-0 shadow-md ${
                    selectedWorkspace?.background
                      ? 'bg-white/95 backdrop-blur-sm'
                      : ''
                  }`}
                >
                  <CardHeader
                    className='px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors'
                    onClick={() => toggleSection('tasks')}
                  >
                    <CardTitle className='flex items-center justify-between text-base'>
                      <div className='flex items-center gap-2'>
                        <Activity className='h-4 w-4' />
                        Task Progress
                        <Badge variant='secondary' className='text-xs'>
                          {tasks?.length || 0}
                        </Badge>
                      </div>
                      {expandedSections.tasks ? (
                        <ChevronDown className='h-4 w-4' />
                      ) : (
                        <ChevronRight className='h-4 w-4' />
                      )}
                    </CardTitle>
                    <CardDescription className='text-xs'>
                      Track progress across all your tasks
                    </CardDescription>
                  </CardHeader>
                  {expandedSections.tasks && (
                    <CardContent className='p-4'>
                      {!paginatedTasks || paginatedTasks.length === 0 ? (
                        <p className='text-gray-500 text-center py-4 text-sm'>
                          No tasks available.
                        </p>
                      ) : (
                        <>
                          <div className='space-y-4'>
                            {paginatedTasks.map((task, index) => (
                              <div
                                key={task?._id || index}
                                className='space-y-2'
                              >
                                <div className='flex items-center justify-between'>
                                  <h4 className='font-medium text-gray-900 text-sm'>
                                    {task?.title ||
                                      task?.name ||
                                      'Unnamed Task'}
                                  </h4>
                                  <div className='flex items-center gap-3'>
                                    <span className='text-xs font-medium text-gray-600'>
                                      {formatPercentage(task?.progress || 0)}%
                                    </span>
                                    {task?.assignedTo ? (
                                      <div className='flex items-center gap-1'>
                                        <Avatar className='h-5 w-5'>
                                          <AvatarFallback className='text-xs'>
                                            {getInitials(task.assignedTo)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className='text-xs text-gray-600 truncate max-w-[80px] hidden sm:block'>
                                          {getDisplayName(task.assignedTo)}
                                        </span>
                                      </div>
                                    ) : (
                                      <Badge
                                        variant='outline'
                                        className='text-xs'
                                      >
                                        Unassigned
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className='w-full'>
                                  <Progress
                                    value={task?.progress || 0}
                                    className='h-2 w-full'
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <PaginationControls
                            currentPage={taskPage}
                            totalPages={totalTaskPages}
                            onPageChange={handleTaskPageChange}
                          />
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}
            </div>

            {/* Right Column - Team Members and Quick Stats */}
            <div className='space-y-6'>
              {/* Team Members */}
              {selectedWorkspace && (
                <>
                  <Card
                    className={`border-0 shadow-md ${
                      selectedWorkspace?.background
                        ? 'bg-white/95 backdrop-blur-sm'
                        : ''
                    }`}
                  >
                    <CardHeader
                      className='px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors'
                      onClick={() => toggleSection('users')}
                    >
                      <CardTitle className='flex items-center justify-between text-base'>
                        <div className='flex items-center gap-2'>
                          <Users className='h-4 w-4' />
                          Team Members
                          <Badge variant='secondary' className='text-xs'>
                            {activeUsers}
                          </Badge>
                        </div>
                        {expandedSections.users ? (
                          <ChevronDown className='h-4 w-4' />
                        ) : (
                          <ChevronRight className='h-4 w-4' />
                        )}
                      </CardTitle>
                      <CardDescription className='text-xs'>
                        {selectedWorkspace?.name || 'Workspace'} workspace
                      </CardDescription>
                    </CardHeader>
                    {expandedSections.users && (
                      <CardContent className='p-4 space-y-4'>
                        {/* Member Management Button */}
                        {canInvite && (
                          <div className='flex gap-2 pb-3 border-b border-gray-200'>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => setShowMemberManagementModal(true)}
                              className='flex items-center gap-2 text-xs h-8'
                            >
                              <UserPlus className='h-3 w-3' />
                              Invite Member
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => {
                                // Placeholder for member management functionality
                                // This could open a different modal for managing existing members
                                console.log(
                                  'Manage members functionality not implemented yet'
                                );
                              }}
                              className='flex items-center gap-2 text-xs h-8'
                            >
                              <Settings className='h-3 w-3' />
                              Manage
                            </Button>
                          </div>
                        )}

                        {!paginatedUsers || paginatedUsers.length === 0 ? (
                          <p className='text-gray-500 text-center py-4 text-sm'>
                            No team members yet.
                          </p>
                        ) : (
                          <>
                            {paginatedUsers.map((user, index) => (
                              <div
                                key={user?._id || index}
                                className='flex items-start gap-3 p-3 bg-gray-50/50 rounded-lg'
                              >
                                <Avatar className='h-8 w-8 flex-shrink-0 mt-1'>
                                  <AvatarFallback className='text-sm font-medium'>
                                    {getInitials(user)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className='flex-1 min-w-0'>
                                  <div className='flex items-center justify-between'>
                                    <p className='font-medium text-gray-900 text-sm truncate'>
                                      {getDisplayName(user)}
                                    </p>
                                    <Badge
                                      variant={
                                        user?.role === 'creatorWorkspace'
                                          ? 'default'
                                          : 'secondary'
                                      }
                                      className='text-xs ml-2 flex-shrink-0'
                                    >
                                      {user?.role === 'creatorWorkspace'
                                        ? 'Creator'
                                        : user?.role === 'adminWorkspace'
                                        ? 'Admin'
                                        : user?.role === 'memberWorkspace'
                                        ? 'Member'
                                        : user?.role || 'Member'}
                                    </Badge>
                                  </div>
                                  <p className='text-xs text-gray-600 truncate mt-1'>
                                    {user?.email || 'No email'}
                                  </p>
                                </div>
                              </div>
                            ))}
                            <PaginationControls
                              currentPage={userPage}
                              totalPages={totalUserPages}
                              onPageChange={handleUserPageChange}
                            />
                          </>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Add spacing between Team Members and Quick Stats */}
                  <div className='h-4'></div>
                </>
              )}

              {/* Quick Stats */}
              <Card
                className={`border-0 shadow-md ${
                  selectedWorkspace?.background
                    ? 'bg-white/95 backdrop-blur-sm'
                    : ''
                }`}
              >
                <CardHeader className='px-4 py-3'>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <BarChart3 className='h-4 w-4' />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className='p-4 space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-gray-600'>
                      Total Workspaces
                    </span>
                    <span className='font-semibold text-sm'>
                      {workspaces?.length || 0}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-gray-600'>
                      Completed Tasks
                    </span>
                    <span className='font-semibold text-sm'>
                      {completedTasks}/{tasks?.length || 0}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-gray-600'>Active Boards</span>
                    <span className='font-semibold text-sm'>
                      {boards?.length || 0}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-gray-600'>Total Lists</span>
                    <span className='font-semibold text-sm'>
                      {lists?.length || 0}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-gray-600'>Team Members</span>
                    <span className='font-semibold text-sm'>{activeUsers}</span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-gray-600'>
                      Team Productivity
                    </span>
                    <Badge
                      variant='outline'
                      className='text-green-600 border-green-600 text-xs'
                    >
                      {overallProgress > 70
                        ? 'High'
                        : overallProgress > 40
                        ? 'Medium'
                        : 'Low'}
                    </Badge>
                  </div>
                  <div className='pt-2 border-t'>
                    <div className='flex items-center justify-between mb-2'>
                      <span className='text-xs text-gray-600'>
                        Overall Progress
                      </span>
                      <span className='text-xs font-medium'>
                        {formatPercentage(overallProgress)}%
                      </span>
                    </div>
                    <Progress value={overallProgress} className='h-1.5' />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Invite Modal - Header */}
          {selectedWorkspace && canInvite && (
            <InviteMemberModal
              show={showInviteModal}
              onHide={() => setShowInviteModal(false)}
              workspaceId={selectedWorkspace._id}
            />
          )}

          {/* Member Management Modal - Team Members Section */}
          {selectedWorkspace && canInvite && (
            <InviteMemberModal
              show={showMemberManagementModal}
              onHide={() => setShowMemberManagementModal(false)}
              workspaceId={selectedWorkspace._id}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
