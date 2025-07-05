"use client";

import { useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Button,
  Form,
  Badge,
  ProgressBar,
} from "react-bootstrap";

// Mock data
const mockData = {
  workspaces: [
    {
      id: 1,
      name: "Design Team",
      boardCount: 5,
      users: [
        {
          id: 1,
          name: "Alice Johnson",
          email: "alice@company.com",
          phone: "+1 (555) 123-4567",
          role: "Lead Designer",
          joinDate: "2023-01-15",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "AJ",
          status: "active",
        },
        {
          id: 2,
          name: "Bob Smith",
          email: "bob@company.com",
          phone: "+1 (555) 234-5678",
          role: "UI Designer",
          joinDate: "2023-03-20",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "BS",
          status: "active",
        },
        {
          id: 3,
          name: "Carol Davis",
          email: "carol@company.com",
          phone: "+1 (555) 345-6789",
          role: "UX Researcher",
          joinDate: "2023-02-10",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "CD",
          status: "inactive",
        },
      ],
      boards: [
        {
          id: 1,
          name: "Website Redesign",
          taskCount: 12,
          tasks: [
            {
              id: 1,
              name: "Create wireframes",
              status: "completed",
              assignee: "Alice Johnson",
            },
            {
              id: 2,
              name: "Design homepage",
              status: "ongoing",
              assignee: "Bob Smith",
            },
            { id: 3, name: "User testing", status: "pending", assignee: null },
            {
              id: 4,
              name: "Mobile responsive",
              status: "ongoing",
              assignee: "Carol Davis",
            },
            {
              id: 5,
              name: "Color scheme",
              status: "completed",
              assignee: "Alice Johnson",
            },
          ],
        },
        {
          id: 2,
          name: "Mobile App",
          taskCount: 8,
          tasks: [
            {
              id: 6,
              name: "App architecture",
              status: "completed",
              assignee: "Bob Smith",
            },
            {
              id: 7,
              name: "UI components",
              status: "ongoing",
              assignee: "Carol Davis",
            },
            {
              id: 8,
              name: "API integration",
              status: "pending",
              assignee: null,
            },
          ],
        },
        {
          id: 3,
          name: "Brand Guidelines",
          taskCount: 6,
          tasks: [
            {
              id: 9,
              name: "Logo design",
              status: "completed",
              assignee: "Alice Johnson",
            },
            {
              id: 10,
              name: "Typography",
              status: "ongoing",
              assignee: "Bob Smith",
            },
          ],
        },
      ],
    },
    {
      id: 2,
      name: "Marketing Team",
      boardCount: 3,
      users: [
        {
          id: 4,
          name: "David Wilson",
          email: "david@company.com",
          phone: "+1 (555) 456-7890",
          role: "Marketing Manager",
          joinDate: "2023-01-05",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "DW",
          status: "active",
        },
        {
          id: 5,
          name: "Emma Brown",
          email: "emma@company.com",
          phone: "+1 (555) 567-8901",
          role: "Content Specialist",
          joinDate: "2023-04-12",
          avatar: "/placeholder.svg?height=32&width=32",
          initials: "EB",
          status: "active",
        },
      ],
      boards: [
        {
          id: 4,
          name: "Campaign Q1",
          taskCount: 10,
          tasks: [
            {
              id: 11,
              name: "Social media strategy",
              status: "completed",
              assignee: "David Wilson",
            },
            {
              id: 12,
              name: "Content calendar",
              status: "ongoing",
              assignee: "Emma Brown",
            },
            { id: 13, name: "Ad creatives", status: "pending", assignee: null },
          ],
        },
        {
          id: 5,
          name: "Product Launch",
          taskCount: 15,
          tasks: [
            {
              id: 14,
              name: "Press release",
              status: "ongoing",
              assignee: "David Wilson",
            },
            {
              id: 15,
              name: "Influencer outreach",
              status: "pending",
              assignee: null,
            },
          ],
        },
      ],
    },
  ],
};

export default function UserDashboard() {
  const [selectedWorkspace, setSelectedWorkspace] = useState(
    mockData.workspaces[0]
  );
  const [selectedBoard, setSelectedBoard] = useState(
    mockData.workspaces[0].boards[0]
  );
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("");

  // Expand/collapse state
  const [expandedSections, setExpandedSections] = useState({
    workspaces: true,
    boards: true,
    tasks: true,
    users: false,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getTaskStats = (tasks) => {
    const completed = tasks.filter(
      (task) => task.status === "completed"
    ).length;
    const ongoing = tasks.filter((task) => task.status === "ongoing").length;
    const pending = tasks.filter((task) => task.status === "pending").length;
    const unassigned = tasks.filter((task) => !task.assignee).length;

    return { completed, ongoing, pending, unassigned, total: tasks.length };
  };

  const taskStats = getTaskStats(selectedBoard.tasks);

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

  const handleAddUser = () => {
    if (newUserName && newUserEmail && newUserRole) {
      console.log("Adding user:", {
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
      });
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("");
    }
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
    transition: "all 0.2s ease",
  };

  const sectionContentStyle = {
    padding: "1rem",
    border: "1px solid #dee2e6",
    borderTop: "none",
    borderRadius: "0 0 0.375rem 0.375rem",
    marginBottom: "1.5rem",
  };

  return (
    <div
      style={{
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
        padding: "2rem 0",
      }}
    >
      <Container fluid>
        {/* Header */}
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
              <Badge bg="secondary">{mockData.workspaces.length}</Badge>
            </div>
            <span>{expandedSections.workspaces ? "▼" : "▶"}</span>
          </div>

          {expandedSections.workspaces && (
            <div style={sectionContentStyle}>
              <Row>
                {mockData.workspaces.map((workspace) => (
                  <Col key={workspace.id} md={6} lg={4} className="mb-3">
                    <Card
                      className={`h-100 ${
                        selectedWorkspace.id === workspace.id
                          ? "border-primary bg-light"
                          : ""
                      }`}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setSelectedWorkspace(workspace);
                        setSelectedBoard(workspace.boards[0]);
                      }}
                    >
                      <Card.Body className="text-center">
                        <Card.Title>{workspace.name}</Card.Title>
                        <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                          <span>📁</span>
                          <span>{workspace.boardCount} Boards</span>
                        </div>
                        <div className="d-flex justify-content-center">
                          <div className="d-flex" style={{ gap: "-8px" }}>
                            {workspace.users.slice(0, 3).map((user, index) => (
                              <div
                                key={user.id}
                                style={{
                                  ...smallAvatarStyle,
                                  marginLeft: index > 0 ? "-8px" : "0",
                                  border: "2px solid white",
                                }}
                                title={user.name}
                              >
                                {user.initials}
                              </div>
                            ))}
                            {workspace.users.length > 3 && (
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
            </div>
          )}
        </div>

        {/* Boards Section */}
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
              <Badge bg="secondary">{selectedWorkspace.boards.length}</Badge>
            </div>
            <span>{expandedSections.boards ? "▼" : "▶"}</span>
          </div>

          {expandedSections.boards && (
            <div style={sectionContentStyle}>
              <Row>
                {selectedWorkspace.boards.map((board) => (
                  <Col key={board.id} md={6} lg={4} className="mb-3">
                    <Card
                      className={`h-100 ${
                        selectedBoard.id === board.id
                          ? "border-primary bg-light"
                          : ""
                      }`}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedBoard(board)}
                    >
                      <Card.Body className="text-center">
                        <Card.Title>{board.name}</Card.Title>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <span>✅</span>
                          <span>{board.taskCount} Tasks</span>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          )}
        </div>

        {/* Tasks Section */}
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
              <Badge bg="secondary">{selectedBoard.tasks.length}</Badge>
            </div>
            <span>{expandedSections.tasks ? "▼" : "▶"}</span>
          </div>

          {expandedSections.tasks && (
            <div style={sectionContentStyle}>
              {/* Statistics Cards */}
              <Row className="mb-4">
                <Col md={6} lg={3} className="mb-3">
                  <Card className="h-100">
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
                  <Card className="h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <Card.Title className="mb-0 fs-6">Completed</Card.Title>
                        <span className="text-success">✅</span>
                      </div>
                      <div className="fs-2 fw-bold text-success">
                        {taskStats.completed}
                      </div>
                      <ProgressBar
                        variant="success"
                        now={(taskStats.completed / taskStats.total) * 100}
                        className="mt-2"
                      />
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6} lg={3} className="mb-3">
                  <Card className="h-100">
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
                        now={(taskStats.ongoing / taskStats.total) * 100}
                        className="mt-2"
                      />
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6} lg={3} className="mb-3">
                  <Card className="h-100">
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
                        now={(taskStats.unassigned / taskStats.total) * 100}
                        className="mt-2"
                      />
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* Tasks Table */}
              <Card>
                <Card.Header>
                  <Card.Title className="mb-0">Tasks</Card.Title>
                </Card.Header>
                <Card.Body>
                  <Table responsive striped hover>
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Assigned To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBoard.tasks.map((task) => (
                        <tr key={task.id}>
                          <td className="fw-medium">{task.name}</td>
                          <td>
                            <Badge bg={getStatusVariant(task.status)}>
                              {getStatusIcon(task.status)}{" "}
                              {task.status.charAt(0).toUpperCase() +
                                task.status.slice(1)}
                            </Badge>
                          </td>
                          <td>
                            {task.assignee ? (
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  style={{
                                    ...smallAvatarStyle,
                                    width: "24px",
                                    height: "24px",
                                    fontSize: "10px",
                                  }}
                                >
                                  {task.assignee
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </div>
                                {task.assignee}
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
                </Card.Body>
              </Card>
            </div>
          )}
        </div>

        {/* User Management Section */}
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
              <Badge bg="secondary">{selectedWorkspace.users.length}</Badge>
            </div>
            <span>{expandedSections.users ? "▼" : "▶"}</span>
          </div>

          {expandedSections.users && (
            <div style={sectionContentStyle}>
              {/* Add New User Form */}
              <Card className="mb-4">
                <Card.Header>
                  <Card.Title className="mb-0 d-flex align-items-center gap-2">
                    <span>➕</span>
                    Add New User
                  </Card.Title>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={3} className="mb-2">
                      <Form.Control
                        type="text"
                        placeholder="Full Name"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                      />
                    </Col>
                    <Col md={3} className="mb-2">
                      <Form.Control
                        type="email"
                        placeholder="Email Address"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                      />
                    </Col>
                    <Col md={3} className="mb-2">
                      <Form.Control
                        type="text"
                        placeholder="Role"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                      />
                    </Col>
                    <Col md={3} className="mb-2">
                      <Button
                        variant="primary"
                        onClick={handleAddUser}
                        className="w-100"
                      >
                        ➕ Add User
                      </Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Users Table */}
              <Card>
                <Card.Header>
                  <Card.Title className="mb-0">Team Members</Card.Title>
                </Card.Header>
                <Card.Body>
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
                      {selectedWorkspace.users.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="d-flex align-items-center gap-3">
                              <div style={avatarStyle}>{user.initials}</div>
                              <div>
                                <div className="fw-medium">{user.name}</div>
                                <div className="text-muted small">
                                  {user.initials}
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
                                {user.phone}
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge bg="info">{user.role}</Badge>
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2 small">
                              <span>📅</span>
                              {new Date(user.joinDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td>
                            <Badge bg={getUserStatusVariant(user.status)}>
                              {user.status}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button variant="outline-primary" size="sm">
                                ✏️
                              </Button>
                              <Button variant="outline-danger" size="sm">
                                ����️
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
