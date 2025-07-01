import React, { useState, useEffect } from "react";
import { useCommon } from "../../contexts/CommonContext";
import {
  Card,
  Image,
  Badge,
  Table,
  ProgressBar,
  Spinner,
  Alert,
  Button,
} from "react-bootstrap";
import {
  Folder,
  CheckCircle,
  Clock,
  ExclamationCircle,
  Person,
} from "react-bootstrap-icons";
import axios from "axios";
import InviteMemberWorkspace from "../workspaces/InviteMemberWorkspace";
import InviteBoardModal from "../boards/InviteBoardModal";

export default function Dashboard() {
  const {
    workspaces,
    boards,
    fetchBoards, // pull in the real function
    userDataLocal,
    apiBaseUrl,
    accessToken,
    loadingWorkspaces,
    loadingBoards,
  } = useCommon();

  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState(null);
  const [showWorkspaceInvite, setShowWorkspaceInvite] = useState(false);
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState(null);
  const [showBoardInvite, setShowBoardInvite] = useState(false);
  const [inviteBoardId, setInviteBoardId] = useState(null);

  // Pick first workspace once loaded
  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspace && !loadingWorkspaces) {
      setSelectedWorkspace(workspaces[0]);
    }
  }, [workspaces, loadingWorkspaces]);

  // Fetch boards whenever the workspace changes
  useEffect(() => {
    if (selectedWorkspace) {
      console.log("Fetching boards for workspace:", selectedWorkspace._id);
      fetchBoards(selectedWorkspace._id);
    }
    // We intentionally omit fetchBoards here to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspace]);

  // Pick first board once boards are loaded
  useEffect(() => {
    if (boards.length > 0 && !selectedBoard && !loadingBoards) {
      setSelectedBoard(boards[0]);
    }
  }, [boards, loadingBoards]);

  // Fetch tasks when the board changes
  useEffect(() => {
    if (selectedBoard) {
      console.log("Selected board changed:", selectedBoard._id);
      fetchTasks(selectedBoard._id);
    }
  }, [selectedBoard]);

  const fetchTasks = async (boardId) => {
    setLoadingTasks(true);
    setTasksError(null);
    try {
      const response = await axios.get(
        `${apiBaseUrl}/task/get-by-board/${boardId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      setTasks(response.data.data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error.response || error);
      setTasksError(
        error.response?.data?.message || "Failed to load tasks for this board."
      );
    } finally {
      setLoadingTasks(false);
    }
  };

  // Calculate task statistics
  const getTaskStats = (tasks) => {
    const completed = tasks.filter((task) => task.progress === 100).length;
    const ongoing = tasks.filter(
      (task) => task.progress > 0 && task.progress < 100
    ).length;
    const pending = tasks.filter((task) => task.progress === 0).length;
    const unassigned = tasks.filter((task) => !task.assignedTo).length;
    return { completed, ongoing, pending, unassigned, total: tasks.length };
  };

  // Check permissions for workspace invitations
  const canInviteToWorkspace = (workspace) => {
    if (!userDataLocal) return false;
    if (String(workspace.creator._id) === String(userDataLocal._id))
      return true;
    const membership = workspace.members.find(
      (m) => m.userId && String(m.userId._id) === String(userDataLocal._id)
    );
    return membership && membership.role === "adminWorkspace";
  };

  // Check permissions for board invitations
  const canInviteToBoard = (board) => {
    if (!userDataLocal) return false;
    const membership = board.members.find(
      (m) => m.userId && String(m.userId._id) === String(userDataLocal._id)
    );
    return membership && membership.role === "admin";
  };

  const taskStats = selectedBoard ? getTaskStats(tasks) : { total: 0 };

  const getStatusVariant = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "ongoing":
        return "primary";
      case "pending":
        return "warning";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="me-1" />;
      case "ongoing":
        return <Clock className="me-1" />;
      case "pending":
        return <ExclamationCircle className="me-1" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-vh-100 bg-light p-4">
      <div className="container">
        {/* Header */}
        <div>
          <h1 className="display-4 text-dark">Dashboard</h1>
          <p className="text-muted">
            Manage your workspaces, boards, and tasks
          </p>
        </div>

        {/* Workspaces Section */}
        <div className="mt-5">
          <h2 className="h4 text-dark mb-3">Your Workspaces</h2>
          {loadingWorkspaces ? (
            <Spinner animation="border" />
          ) : workspaces.length === 0 ? (
            <Alert variant="info">No workspaces available.</Alert>
          ) : (
            <div className="row">
              {workspaces.map((workspace) => (
                <div key={workspace._id} className="col-md-4 mb-4">
                  <Card
                    className={`cursor-pointer ${
                      selectedWorkspace?._id === workspace._id
                        ? "border-primary"
                        : ""
                    }`}
                    onClick={() => setSelectedWorkspace(workspace)}
                  >
                    <Card.Body className="text-center">
                      <Card.Title>{workspace.name}</Card.Title>
                      <div className="d-flex justify-content-center align-items-center mb-3">
                        <Folder className="me-2" />
                        <span>{workspace.countBoard || 0} Boards</span>
                      </div>
                      <div className="d-flex justify-content-center mb-3">
                        {workspace.members.slice(0, 3).map((member) => (
                          <Image
                            key={member._id}
                            src={member.userId?.avatar || "/placeholder.svg"}
                            roundedCircle
                            width={32}
                            height={32}
                            className="me-1"
                          />
                        ))}
                        {workspace.members.length > 3 && (
                          <div
                            className="bg-secondary text-white rounded-circle d-flex align-items-center justify-content-center"
                            style={{ width: 32, height: 32 }}
                          >
                            +{workspace.members.length - 3}
                          </div>
                        )}
                      </div>
                      {canInviteToWorkspace(workspace) && (
                        <Button
                          variant="outline-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInviteWorkspaceId(workspace._id);
                            setShowWorkspaceInvite(true);
                          }}
                        >
                          Invite
                        </Button>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Boards Section */}
        {selectedWorkspace && (
          <div className="mt-5">
            <h2 className="h4 text-dark mb-3">{selectedWorkspace.name}</h2>
            {loadingBoards ? (
              <Spinner animation="border" />
            ) : boards.length === 0 ? (
              <Alert variant="info">
                No boards available in this workspace.
              </Alert>
            ) : (
              <div className="row">
                {boards.map((board) => (
                  <div key={board._id} className="col-md-4 mb-4">
                    <Card
                      className={`cursor-pointer ${
                        selectedBoard?._id === board._id ? "border-primary" : ""
                      }`}
                      onClick={() => setSelectedBoard(board)}
                    >
                      <Card.Body className="text-center">
                        <Card.Title>{board.name}</Card.Title>
                        <div className="d-flex justify-content-center align-items-center mb-3">
                          <CheckCircle className="me-2" />
                          <span>{board.tasks?.length || 0} Tasks</span>
                        </div>
                        {canInviteToBoard(board) && (
                          <Button
                            variant="outline-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInviteBoardId(board._id);
                              setShowBoardInvite(true);
                            }}
                          >
                            Invite
                          </Button>
                        )}
                      </Card.Body>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Board Details Section */}
        {selectedBoard && (
          <div className="mt-5">
            <h2 className="h4 text-dark mb-4">{selectedBoard.name}</h2>

            {/* Task Statistics */}
            <div className="row mb-4">
              <div className="col-md-3">
                <Card>
                  <Card.Body>
                    <Card.Title>Total Tasks</Card.Title>
                    <h3>{taskStats.total}</h3>
                  </Card.Body>
                </Card>
              </div>
              <div className="col-md-3">
                <Card>
                  <Card.Body>
                    <Card.Title>Completed</Card.Title>
                    <h3 className="text-success">{taskStats.completed}</h3>
                    <ProgressBar
                      now={(taskStats.completed / taskStats.total) * 100 || 0}
                      variant="success"
                    />
                  </Card.Body>
                </Card>
              </div>
              <div className="col-md-3">
                <Card>
                  <Card.Body>
                    <Card.Title>In Progress</Card.Title>
                    <h3 className="text-primary">{taskStats.ongoing}</h3>
                    <ProgressBar
                      now={(taskStats.ongoing / taskStats.total) * 100 || 0}
                      variant="primary"
                    />
                  </Card.Body>
                </Card>
              </div>
              <div className="col-md-3">
                <Card>
                  <Card.Body>
                    <Card.Title>Unassigned</Card.Title>
                    <h3 className="text-warning">{taskStats.unassigned}</h3>
                    <ProgressBar
                      now={(taskStats.unassigned / taskStats.total) * 100 || 0}
                      variant="warning"
                    />
                  </Card.Body>
                </Card>
              </div>
            </div>

            {/* Task Table */}
            <Card>
              <Card.Header>
                <Card.Title>Tasks</Card.Title>
              </Card.Header>
              <Card.Body>
                {loadingTasks ? (
                  <Spinner animation="border" />
                ) : tasksError ? (
                  <Alert variant="danger">{tasksError}</Alert>
                ) : tasks.length === 0 ? (
                  <Alert variant="info">No tasks available.</Alert>
                ) : (
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Assigned To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => {
                        const status =
                          task.progress === 100
                            ? "completed"
                            : task.progress > 0
                            ? "ongoing"
                            : "pending";
                        return (
                          <tr key={task._id}>
                            <td>{task.title}</td>
                            <td>
                              <Badge bg={getStatusVariant(status)}>
                                {getStatusIcon(status)}
                                {status.charAt(0).toUpperCase() +
                                  status.slice(1)}
                              </Badge>
                            </td>
                            <td>
                              {task.assignedTo ? (
                                <div className="d-flex align-items-center">
                                  <Image
                                    src={
                                      task.assignedTo.avatar ||
                                      "/placeholder.svg"
                                    }
                                    roundedCircle
                                    width={24}
                                    height={24}
                                    className="me-2"
                                  />
                                  {task.assignedTo.username}
                                </div>
                              ) : (
                                <span className="text-muted">Unassigned</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </Card.Body>
            </Card>
          </div>
        )}
      </div>

      {/* Invite Modals */}
      {showWorkspaceInvite && (
        <InviteMemberWorkspace
          show={showWorkspaceInvite}
          onHide={() => setShowWorkspaceInvite(false)}
          workspaceId={inviteWorkspaceId}
        />
      )}
      {showBoardInvite && (
        <InviteBoardModal
          show={showBoardInvite}
          onHide={() => setShowBoardInvite(false)}
          workspaceId={selectedWorkspace._id}
          boardId={inviteBoardId}
        />
      )}
    </div>
  );
}
