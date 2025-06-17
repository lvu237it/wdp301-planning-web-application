// src/pages/profile/Profile.jsx
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  Form,
  Spinner,
  Image,
  Modal,
  InputGroup,
  FormControl,
} from "react-bootstrap";
import {
  FaCamera,
  FaEdit,
  FaMapMarkerAlt,
  FaUser,
  FaCalendarAlt,
  FaCheckCircle,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import { useCommon } from "../../contexts/CommonContext";
import "./profile.css";

const Profile = () => {
  const {
    fetchUserProfile,
    updateUserProfile,
    uploadImageToCloudinary,
    toast,
    isMobile,
  } = useCommon();

  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    avatar: "",
    fullname: "",
    username: "",
    email: "",
    about: "",
    experience: "",
    skills: [],
    yearOfExperience: 0,
    availability: { status: "available", willingToJoin: true },
    expectedWorkDuration: { min: 0, max: 0, unit: "hours" },
  });
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const user = await fetchUserProfile();
      if (user) {
        setProfile(user);
        setFormData({
          avatar: user.avatar || "",
          fullname: user.fullname || "",
          username: user.username || "",
          email: user.email || "",
          about: user.about || "",
          experience: user.experience || "",
          skills: user.skills || [],
          yearOfExperience: user.yearOfExperience || 0,
          availability: user.availability || {
            status: "available",
            willingToJoin: true,
          },
          expectedWorkDuration: user.expectedWorkDuration || {
            min: 0,
            max: 0,
            unit: "hours",
          },
        });
      }
    };
    loadProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes("availability.")) {
      const key = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        availability: {
          ...prev.availability,
          [key]: type === "checkbox" ? checked : value,
        },
      }));
    } else if (name.includes("expectedWorkDuration.")) {
      const key = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        expectedWorkDuration: {
          ...prev.expectedWorkDuration,
          [key]: key === "unit" ? value : Number(value),
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  const handleAddSkill = () => {
    const s = newSkill.trim();
    if (s && !formData.skills.includes(s)) {
      setFormData((prev) => ({ ...prev, skills: [...prev.skills, s] }));
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skill) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadImageToCloudinary(file);
      setFormData((prev) => ({ ...prev, avatar: url }));
      await updateUserProfile({ avatar: url });
      setProfile((prev) => ({ ...prev, avatar: url }));
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await updateUserProfile(formData);
    if (ok) {
      setProfile((prev) => ({ ...prev, ...formData }));
      setIsEditing(false);
      toast.success("Profile updated");
    }
  };

  if (!profile) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Container className={`${isMobile ? "mobile" : ""} profile-content`}>
      {/* Header */}
      <Card className="mb-4">
        <div className="profile-cover" />
        <Card.Body className="d-flex align-items-end profile-info">
          <div className="position-relative me-4 profile-avatar">
            <Image
              src={profile.avatar}
              roundedCircle
              width={120}
              height={120}
              alt="avatar"
            />
            <label className="btn-edit-avatar">
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                hidden
              />
              <FaCamera />
            </label>
          </div>
          <div className="flex-grow-1">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2>{profile.fullname}</h2>
                <div className="profile-subinfo">
                  {profile.username && (
                    <Badge bg="secondary" className="me-2">
                      <FaUser /> @{profile.username}
                    </Badge>
                  )}
                  {profile.location && (
                    <Badge bg="secondary">
                      <FaMapMarkerAlt /> {profile.location}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline-success"
                onClick={() => setIsEditing(true)}
              >
                <FaEdit /> Edit
              </Button>
            </div>
            <div className="mt-2">
              <Badge
                bg={
                  profile.availability.status === "available"
                    ? "success"
                    : "danger"
                }
                className="me-2"
              >
                <FaCheckCircle />{" "}
                {profile.availability.status === "available"
                  ? "Available"
                  : "Busy"}
              </Badge>
              {profile.availability.willingToJoin && (
                <Badge bg="info" className="me-2">
                  Open to opportunities
                </Badge>
              )}
              <Badge bg="warning">
                <FaCalendarAlt /> {profile.yearOfExperience} yrs
              </Badge>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Content Grid */}
      <Row className="gy-4">
        <Col lg={6}>
          <Card className="profile-card">
            <Card.Header>About</Card.Header>
            <Card.Body>
              <p>{profile.about || "No description."}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="profile-card">
            <Card.Header>Experience</Card.Header>
            <Card.Body>
              <p>{profile.experience || "No experience info."}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="profile-card">
            <Card.Header>Work Preferences</Card.Header>
            <Card.Body>
              <p>
                Duration: {profile.expectedWorkDuration.min}–
                {profile.expectedWorkDuration.max}{" "}
                {profile.expectedWorkDuration.unit}
              </p>
              <p>Status: {profile.availability.status}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="profile-card">
            <Card.Header>Skills</Card.Header>
            <Card.Body>
              {profile.skills.length ? (
                profile.skills.map((s, i) => (
                  <Badge bg="secondary" key={i} className="me-1">
                    {s}
                  </Badge>
                ))
              ) : (
                <p>No skills listed.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Edit Modal */}
      <Modal show={isEditing} onHide={() => setIsEditing(false)} size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit Profile</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control
                    name="fullname"
                    value={formData.fullname}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>About</Form.Label>
                  <Form.Control
                    as="textarea"
                    name="about"
                    rows={3}
                    value={formData.about}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Experience</Form.Label>
                  <Form.Control
                    as="textarea"
                    name="experience"
                    rows={2}
                    value={formData.experience}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Years of Exp</Form.Label>
                  <Form.Control
                    type="number"
                    name="yearOfExperience"
                    min={0}
                    value={formData.yearOfExperience}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Availability Status</Form.Label>
                  <Form.Select
                    name="availability.status"
                    value={formData.availability.status}
                    onChange={handleInputChange}
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4} className="d-flex align-items-center">
                <Form.Check
                  type="checkbox"
                  label="Open to opportunities"
                  name="availability.willingToJoin"
                  checked={formData.availability.willingToJoin}
                  onChange={handleInputChange}
                />
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Min Duration</Form.Label>
                  <Form.Control
                    type="number"
                    name="expectedWorkDuration.min"
                    min={0}
                    value={formData.expectedWorkDuration.min}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Max Duration</Form.Label>
                  <Form.Control
                    type="number"
                    name="expectedWorkDuration.max"
                    min={0}
                    value={formData.expectedWorkDuration.max}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Unit</Form.Label>
                  <Form.Select
                    name="expectedWorkDuration.unit"
                    value={formData.expectedWorkDuration.unit}
                    onChange={handleInputChange}
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Skills</Form.Label>
                  <InputGroup className="mb-2">
                    <FormControl
                      placeholder="Add a skill"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), handleAddSkill())
                      }
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={handleAddSkill}
                    >
                      <FaPlus />
                    </Button>
                  </InputGroup>
                  {formData.skills.map((s, i) => (
                    <Badge bg="secondary" key={i} className="me-1">
                      {s}{" "}
                      <FaTimes
                        style={{ cursor: "pointer" }}
                        onClick={() => handleRemoveSkill(s)}
                      />
                    </Badge>
                  ))}
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default Profile;
