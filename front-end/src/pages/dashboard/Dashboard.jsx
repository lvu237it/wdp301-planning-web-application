import React, { useState, useEffect } from "react";
import { useCommon } from "../../contexts/CommonContext";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Button,
  Badge,
  ProgressBar,
} from "react-bootstrap";
import InviteMemberModal from "../workspaces/InviteMemberWorkspace"; // Adjust the path as needed

const Dashboard = () => {
  const { apiBaseUrl, accessToken } = useCommon();
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    workspaces: true,
    boards: true,
    tasks: true,
    users: false,
  });
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Fetch workspaces on mount
  useEffect(() => {
    const fetchWorkspaces = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${apiBaseUrl}/workspace`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setWorkspaces(response.data.data || []);
        if (response.data.data.length > 0) {
          setSelectedWorkspace(response.data.data[0]);
        }
      } catch (err) {
        console.error("Error fetching workspaces:", err);
        setError("Failed to fetch workspaces.");
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspaces();
  }, [apiBaseUrl, accessToken]);

  // Fetch boards when workspace is selected
  useEffect(() => {
    if (selectedWorkspace) {
      const fetchBoards = async () => {
        setLoading(true);
        try {
          const response = await axios.get(
            `${apiBaseUrl}/workspace/${selectedWorkspace._id}/board`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          setBoards(response.data.boards || []);
          if (response.data.boards.length > 0) {
            setSelectedBoard(response.data.boards[0]);
          }
        } catch (err) {
          console.error("Error fetching boards:", err);
          setError("Failed to fetch boards.");
        } finally {
          setLoading(false);
        }
      };
      fetchBoards();
    }
  }, [selectedWorkspace, apiBaseUrl, accessToken]);

  // Fetch tasks when board is selected
  useEffect(() => {
    if (selectedBoard) {
      const fetchTasks = async () => {
        setLoading(true);
        try {
          const response = await axios.get(
            `${apiBaseUrl}/task/get-by-board/${selectedBoard._id}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          setTasks(response.data.data || []);
        } catch (err) {
          console.error("Error fetching tasks:", err);
          setError("Failed to fetch tasks.");
        } finally {
          setLoading(false);
        }
      };
      fetchTasks();
    }
  }, [selectedBoard, apiBaseUrl, accessToken]);

  // Fetch users for the selected workspace
  useEffect(() => {
    if (selectedWorkspace) {
      const fetchUsers = async () => {
        setLoading(true);
        try {
          const response = await axios.get(
            `${apiBaseUrl}/workspace/${selectedWorkspace._id}/users`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          setUsers(response.data.users || []);
        } catch (err) {
          console.error("Error fetching users:", err);
          setError("Failed to fetch users.");
        } finally {
          setLoading(false);
        }
      };
      fetchUsers();
    }
  }, [selectedWorkspace, apiBaseUrl, accessToken]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleWorkspaceSelect = (workspace) => {
    setSelectedWorkspace(workspace);
    setBoards([]);
    setSelectedBoard(null);
    setTasks([]);
  };

  const handleBoardSelect = (board) => {
    setSelectedBoard(board);
    setTasks([]);
  };

  const getTaskStats = (tasks) => {
    const completed = tasks.filter(
      (task) => task.status === "completed"
    ).length;
    const ongoing = tasks.filter((task) => task.status === "ongoing").length;
    const pending = tasks.filter((task) => task.status === "pending").length;
    const unassigned = tasks.filter((task) => !task.assignedTo).length;
    return { completed, ongoing, pending, unassigned, total: tasks.length };
  };

  const taskStats = selectedBoard
    ? getTaskStats(tasks)
    : { completed: 0, ongoing: 0, pending: 0, unassigned: 0, total: 0 };

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
        return "✓";
      case "ongoing":
        return "⏳";
      case "pending":
        return "⚠";
      default:
        return "○";
    }
  };

  const getUserStatusVariant = (status) => {
    return status === "active" ? "success" : "secondary";
  };

  const avatarStyle = {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#6c757d",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "bold",
  };

  const smallAvatarStyle = {
    ...avatarStyle,
    width: "32px",
    height: "32px",
    fontSize: "12px",
  };

  const sectionHeaderStyle = {
    backgroundColor: "#f8f9fa",
    border: "1px solid #dee2e6",
    borderRadius: "0.375rem",
    padding: "1rem",
    cursor: "pointer",
    marginBottom: "0.5rem",
  };

  const sectionContentStyle = {
    padding: "1rem",
    border: "1px solid #dee2e6",
    borderTop: "none",
    borderRadius: "0 0 0.375rem 0.375rem",
    marginBottom: "1.5rem",
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div
      style={{
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
        padding: "2rem 0",
      }}
    >
      <Container fluid>
        <Row className="mb-4">
          <Col>
            <h1 className="display-4 fw-bold text-dark">Dashboard</h1>
            <p className="text-muted">
              Manage your workspaces, boards, and tasks
            </p>
          </Col>
        </Row>

        {/* Workspaces Section */}
        <div>
          <div
            style={sectionHeaderStyle}
            onClick={() => toggleSection("workspaces")}
            className="d-flex justify-content-between align-items-center"
          >
            <div className="d-flex align-items-center gap-2">
              <span>📁</span>
              <span className="fs-5 fw-semibold">Your Workspaces</span>
              <Badge bg="secondary">{workspaces.length}</Badge>
            </div>
            <span>{expandedSections.workspaces ? "▼" : "▶"}</span>
          </div>
          {expandedSections.workspaces && (
            <div style={sectionContentStyle}>
              {workspaces.length === 0 ? (
                <p className="text-muted">
                  You have no workspaces. Create one to get started.
                </p>
              ) : (
                <Row>
                  {workspaces.map((workspace) => (
                    <Col key={workspace._id} md={6} lg={4} className="mb-3">
                      <Card
                        className={`h-100 ${
                          selectedWorkspace?._id === workspace._id
                            ? "border-primary bg-light"
                            : ""
                        }`}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleWorkspaceSelect(workspace)}
                      >
                        <Card.Body className="text-center">
                          <Card.Title>{workspace.name}</Card.Title>
                          <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                            <span>📁</span>
                            <span>{workspace.boardCount || 0} Boards</span>
                          </div>
                          <div className="d-flex justify-content-center">
                            <div className="d-flex" style={{ gap: "-8px" }}>
                              {workspace.users
                                ?.slice(0, 3)
                                .map((user, index) => (
                                  <div
                                    key={user._id}
                                    style={{
                                      ...smallAvatarStyle,
                                      marginLeft: index > 0 ? "-8px" : "0",
                                      border: "2px solid white",
                                    }}
                                    title={user.name}
                                  >
                                    {user.initials ||
                                      user.name?.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                              {workspace.users?.length > 3 && (
                                <div
                                  style={{
                                    ...smallAvatarStyle,
                                    marginLeft: "-8px",
                                    backgroundColor: "#e9ecef",
                                    color: "#6c757d",
                                    border: "2px solid white",
                                  }}
                                >
                                  +{workspace.users.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </div>
          )}
        </div>

        {/* Boards Section */}
        {selectedWorkspace && (
          <div>
            <div
              style={sectionHeaderStyle}
              onClick={() => toggleSection("boards")}
              className="d-flex justify-content-between align-items-center"
            >
              <div className="d-flex align-items-center gap-2">
                <span>✅</span>
                <span className="fs-5 fw-semibold">
                  {selectedWorkspace.name} - Boards
                </span>
                <Badge bg="secondary">{boards.length}</Badge>
              </div>
              <span>{expandedSections.boards ? "▼" : "▶"}</span>
            </div>
            {expandedSections.boards && (
              <div style={sectionContentStyle}>
                {boards.length === 0 ? (
                  <p className="text-muted">
                    No boards available for this workspace.
                  </p>
                ) : (
                  <Row>
                    {boards.map((board) => (
                      <Col key={board._id} md={6} lg={4} className="mb-3">
                        <Card
                          className={`h-100 ${
                            selectedBoard?._id === board._id
                              ? "border-primary bg-light"
                              : ""
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => handleBoardSelect(board)}
                        >
                          <Card.Body className="text-center">
                            <Card.Title>{board.name}</Card.Title>
                            <div className="d-flex align-items-center justify-content-center gap-2">
                              <span>✅</span>
                              <span>{board.taskCount || 0} Tasks</span>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tasks Section */}
        {selectedBoard && (
          <div>
            <div
              style={sectionHeaderStyle}
              onClick={() => toggleSection("tasks")}
              className="d-flex justify-content-between align-items-center"
            >
              <div className="d-flex align-items-center gap-2">
                <span>⏰</span>
                <span className="fs-5 fw-semibold">
                  {selectedBoard.name} - Tasks & Statistics
                </span>
                <Badge bg="secondary">{tasks.length}</Badge>
              </div>
              <span>{expandedSections.tasks ? "▼" : "▶"}</span>
            </div>
            {expandedSections.tasks && (
              <div style={sectionContentStyle}>
                <Row className="mb-4">
                  <Col md={6} lg={3} className="mb-3">
                    <Card>
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <Card.Title className="mb-0 fs-6">
                            Total Tasks
                          </Card.Title>
                          <span>📊</span>
                        </div>
                        <div className="fs-2 fw-bold">{taskStats.total}</div>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={6} lg={3} className="mb-3">
                    <Card>
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <Card.Title className="mb-0 fs-6">
                            Completed
                          </Card.Title>
                          <span className="text-success">✅</span>
                        </div>
                        <div className="fs-2 fw-bold text-success">
                          {taskStats.completed}
                        </div>
                        <ProgressBar
                          variant="success"
                          now={
                            (taskStats.completed / taskStats.total) * 100 || 0
                          }
                          className="mt-2"
                        />
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={6} lg={3} className="mb-3">
                    <Card>
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <Card.Title className="mb-0 fs-6">
                            In Progress
                          </Card.Title>
                          <span className="text-primary">⏳</span>
                        </div>
                        <div className="fs-2 fw-bold text-primary">
                          {taskStats.ongoing}
                        </div>
                        <ProgressBar
                          variant="primary"
                          now={(taskStats.ongoing / taskStats.total) * 100 || 0}
                          className="mt-2"
                        />
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={6} lg={3} className="mb-3">
                    <Card>
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <Card.Title className="mb-0 fs-6">
                            Unassigned
                          </Card.Title>
                          <span className="text-warning">👤</span>
                        </div>
                        <div className="fs-2 fw-bold text-warning">
                          {taskStats.unassigned}
                        </div>
                        <ProgressBar
                          variant="warning"
                          now={
                            (taskStats.unassigned / taskStats.total) * 100 || 0
                          }
                          className="mt-2"
                        />
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
                <Card>
                  <Card.Header>
                    <Card.Title className="mb-0">Tasks</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    {tasks.length === 0 ? (
                      <p className="text-muted">
                        No tasks available for this board.
                      </p>
                    ) : (
                      <Table responsive striped hover>
                        <thead>
                          <tr>
                            <th>Task</th>
                            <th>Status</th>
                            <th>Assigned To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasks.map((task) => (
                            <tr key={task._id}>
                              <td className="fw-medium">
                                {task.title || task.name}
                              </td>
                              <td>
                                <Badge bg={getStatusVariant(task.status)}>
                                  {getStatusIcon(task.status)}{" "}
                                  {task.status.charAt(0).toUpperCase() +
                                    task.status.slice(1)}
                                </Badge>
                              </td>
                              <td>
                                {task.assignedTo ? (
                                  <div className="d-flex align-items-center gap-2">
                                    <div
                                      style={{
                                        ...smallAvatarStyle,
                                        width: "24px",
                                        height: "24px",
                                        fontSize: "10px",
                                      }}
                                    >
                                      {task.assignedTo.username
                                        ?.charAt(0)
                                        .toUpperCase() || "U"}
                                    </div>
                                    {task.assignedTo.username || "Unknown"}
                                  </div>
                                ) : (
                                  <span className="text-muted fst-italic">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Card.Body>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* User Management Section */}
        {selectedWorkspace && (
          <div>
            <div
              style={sectionHeaderStyle}
              onClick={() => toggleSection("users")}
              className="d-flex justify-content-between align-items-center"
            >
              <div className="d-flex align-items-center gap-2">
                <span>👥</span>
                <span className="fs-5 fw-semibold">
                  User Management - {selectedWorkspace.name}
                </span>
                <Badge bg="secondary">{users.length}</Badge>
              </div>
              <span>{expandedSections.users ? "▼" : "▶"}</span>
            </div>
            {expandedSections.users && (
              <div style={sectionContentStyle}>
                <Card className="mb-4">
                  <Card.Header>
                    <Card.Title className="mb-0 d-flex align-items-center gap-2">
                      <span>➕</span>
                      Invite User to Workspace
                    </Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <Button
                      variant="primary"
                      onClick={() => setShowInviteModal(true)}
                    >
                      Invite User
                    </Button>
                  </Card.Body>
                </Card>
                <Card>
                  <Card.Header>
                    <Card.Title className="mb-0">Team Members</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    {users.length === 0 ? (
                      <p className="text-muted">No users in this workspace.</p>
                    ) : (
                      <Table responsive striped hover>
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Contact</th>
                            <th>Role</th>
                            <th>Join Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user._id}>
                              <td>
                                <div className="d-flex align-items-center gap-3">
                                  <div style={avatarStyle}>
                                    {user.initials ||
                                      user.name?.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="fw-medium">{user.name}</div>
                                    <div className="text-muted small">
                                      {user.initials ||
                                        user.name?.charAt(0).toUpperCase()}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div>
                                  <div className="d-flex align-items-center gap-2 small">
                                    <span>✉️</span>
                                    {user.email}
                                  </div>
                                  <div className="d-flex align-items-center gap-2 small text-muted">
                                    <span>📞</span>
                                    {user.phone || "N/A"}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="info">{user.role}</Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2 small">
                                  <span>📅</span>
                                  {user.joinDate
                                    ? new Date(
                                        user.joinDate
                                      ).toLocaleDateString()
                                    : "N/A"}
                                </div>
                              </td>
                              <td>
                                <Badge
                                  bg={getUserStatusVariant(
                                    user.status || "active"
                                  )}
                                >
                                  {user.status || "active"}
                                </Badge>
                              </td>
                              <td>
                                <div className="d-flex gap-2">
                                  <Button variant="outline-primary" size="sm">
                                    ✏️
                                  </Button>
                                  <Button variant="outline-danger" size="sm">
                                    🗑️
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Card.Body>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Invite Member Modal */}
        {selectedWorkspace && (
          <InviteMemberModal
            show={showInviteModal}
            onHide={() => setShowInviteModal(false)}
            workspaceId={selectedWorkspace._id}
          />
        )}
      </Container>
    </div>
  );
};

export default Dashboard;
