import React, { useState, useEffect } from "react";
import { initializeIcons } from "@fluentui/font-icons-mdl2";
import "devicon/devicon.min.css";
import { Icon } from "@iconify/react";
import { SiGoogledocs, SiGooglesheets, SiGoogleslides } from "react-icons/si";
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

// Initialize Fluent UI MDL2 icons
initializeIcons();

const Profile = () => {
  const {
    fetchUserProfile,
    updateUserProfile,
    uploadImageToCloudinary,
    toast,
    isMobile,
    skillsList,
    loadingSkills,
    skillsError,
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
    skills: [], // Array of lowercase skill values
    yearOfExperience: 0,
    availability: {
      status: "available",
      willingToJoin: true,
    },
    expectedWorkDuration: {
      startDate: "", // e.g. "2025-07-01"
      endDate: "", // e.g. "2025-12-31"
    },
  });
  const [newSkill, setNewSkill] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      const user = await fetchUserProfile();
      if (!user) return;

      // Normalize skills to lowercase strings
      const normalizedSkills = (user.skills || []).map((s) =>
        typeof s === "string" ? s : s?.value || ""
      );

      setProfile(user);
      setFormData({
        avatar: user.avatar || "",
        fullname: user.fullname || "",
        username: user.username || "",
        email: user.email || "",
        about: user.about || "",
        experience: user.experience || "",
        skills: normalizedSkills,
        yearOfExperience: user.yearOfExperience || 0,
        availability: user.availability || {
          status: "available",
          willingToJoin: true,
        },
        expectedWorkDuration: {
          startDate: user.expectedWorkDuration?.startDate
            ? user.expectedWorkDuration.startDate.split("T")[0]
            : "",
          endDate: user.expectedWorkDuration?.endDate
            ? user.expectedWorkDuration.endDate.split("T")[0]
            : "",
        },
      });
    };
    loadProfile();
  }, [fetchUserProfile]);

  // Handle all form inputs, including nested fields
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
      const key = name.split(".")[1]; // "startDate" or "endDate"
      setFormData((prev) => ({
        ...prev,
        expectedWorkDuration: {
          ...prev.expectedWorkDuration,
          [key]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  // Skill search/filter
  const filteredSkills = (skillsList || []).filter((s) => {
    if (!s?.value || !Array.isArray(s.tags)) return false;
    return (
      !formData.skills.includes(s.value) &&
      (s.value.includes(newSkill.toLowerCase()) ||
        s.tags.some((t) => t.toLowerCase().includes(newSkill.toLowerCase())))
    );
  });

  const handleSearchChange = (e) => {
    setNewSkill(e.target.value.toLowerCase());
    setShowSuggestions(true);
  };

  const handleSelectSkill = (skillValue) => {
    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, skillValue],
    }));
    setNewSkill("");
    setShowSuggestions(false);
  };

  const handleRemoveSkill = (skillValue) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((v) => v !== skillValue),
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadImageToCloudinary(file);
      await updateUserProfile({ avatar: url });
      setProfile((prev) => ({ ...prev, avatar: url }));
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // We now send skills as array of values, plus the two dates
    const ok = await updateUserProfile(formData);
    if (ok) {
      setProfile((prev) => ({ ...prev, ...formData }));
      setIsEditing(false);
      toast.success("Profile updated");
    }
  };

  if (!profile || loadingSkills) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </div>
    );
  }
  if (skillsError) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <p>Error loading skills: {skillsError}</p>
      </div>
    );
  }

  const renderIcon = (iconKey) => {
    if (!iconKey) return null;
    if (iconKey.startsWith("devicon:")) {
      return <i className={`${iconKey.replace(":", "-")} colored me-1`} />;
    }
    if (iconKey.startsWith("fluent-mdl2:")) {
      const name = iconKey.split(":")[1];
      return (
        <i className={`ms-Icon ms-Icon--${name} me-1`} aria-hidden="true" />
      );
    }
    if (iconKey === "si:googledocs")
      return <SiGoogledocs className="me-1" size={20} />;
    if (iconKey === "si:googlesheets")
      return <SiGooglesheets className="me-1" size={20} />;
    if (iconKey === "si:googleslides")
      return <SiGoogleslides className="me-1" size={20} />;
    return <Icon icon={iconKey} width={20} height={20} className="me-1" />;
  };

  return (
    <Container className={`${isMobile ? "mobile" : ""} profile-content`}>
      {/* Header */}
      <Card className="mb-4">
        <div className="profile-cover" />
        <Card.Body className="d-flex align-items-end profile-info">
          <div className="position-relative me-4 profile-avatar">
            <Image
              src={profile.avatar || "https://via.placeholder.com/120"}
              roundedCircle
              width={120}
              height={120}
              alt="avatar"
            />
            <label className="btn-edit-avatar">
              <Form.Control
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageUpload}
              />
              <FaCamera />
            </label>
          </div>
          <div className="flex-grow-1">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2>{profile.fullname || "No Name"}</h2>
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
                Contract: {profile.expectedWorkDuration.startDate || "—"} –{" "}
                {profile.expectedWorkDuration.endDate || "—"}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="profile-card">
            <Card.Header>Skills</Card.Header>
            <Card.Body>
              {profile.skills.length > 0 ? (
                profile.skills.map((val, i) => {
                  const sk = skillsList.find((s) => s.value === val);
                  return (
                    <Badge bg="secondary" key={i} className="me-1 mb-1">
                      {renderIcon(sk?.icon)} {sk?.value || val}
                    </Badge>
                  );
                })
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
          <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <Row className="g-3">
              {/* Fullname, Username, Email */}
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

              {/* About & Experience */}
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

              {/* Years & Availability */}
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

              {/* Contract Dates */}
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Contract Start</Form.Label>
                  <Form.Control
                    type="date"
                    name="expectedWorkDuration.startDate"
                    value={formData.expectedWorkDuration.startDate}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Contract End</Form.Label>
                  <Form.Control
                    type="date"
                    name="expectedWorkDuration.endDate"
                    value={formData.expectedWorkDuration.endDate}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>

              {/* Skills */}
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Skills</Form.Label>
                  <div className="skill-select">
                    <InputGroup>
                      <FormControl
                        placeholder="Search a skill…"
                        value={newSkill}
                        onChange={handleSearchChange}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() =>
                          setTimeout(() => setShowSuggestions(false), 150)
                        }
                      />
                      <Button
                        variant="outline-secondary"
                        disabled={
                          !filteredSkills.find((s) => s.value === newSkill)
                        }
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const match = filteredSkills.find(
                            (s) => s.value === newSkill
                          );
                          if (match) handleSelectSkill(match.value);
                        }}
                      >
                        <FaPlus />
                      </Button>
                    </InputGroup>
                    {showSuggestions && filteredSkills.length > 0 && (
                      <div className="skill-search-dropdown">
                        {filteredSkills.map((s) => (
                          <div
                            key={s._id}
                            className="skill-search-item d-flex justify-content-between align-items-center"
                            onMouseDown={() => handleSelectSkill(s.value)}
                          >
                            <div>
                              {renderIcon(s.icon)}
                              <span className="ms-1">{s.value}</span>
                            </div>
                            <small className="text-muted">
                              {(s.tags || []).join(", ")}
                            </small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    {formData.skills.map((val, i) => (
                      <Badge bg="secondary" key={i} className="me-1 mb-1">
                        {renderIcon(
                          skillsList.find((sk) => sk.value === val)?.icon
                        )}
                        {val}{" "}
                        <FaTimes
                          style={{ cursor: "pointer" }}
                          onClick={() => handleRemoveSkill(val)}
                        />
                      </Badge>
                    ))}
                  </div>
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
