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
    skills: [], // Array of skill names (strings)
    yearOfExperience: 0,
    availability: { status: "available", willingToJoin: true },
    expectedWorkDuration: { min: 0, max: 0, unit: "hours" },
  });
  const [newSkill, setNewSkill] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const user = await fetchUserProfile();
      if (user) {
        // Normalize skills to use skill names (strings) from backend
        const normalizedSkills = (user.skills || [])
          .map((skill) =>
            typeof skill === "string" ? skill : skill?.name || ""
          )
          .filter(Boolean); // Remove any undefined/null entries
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
  // fetchUserProfile

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

  // Filter skills, excluding already selected and matching name or tags
  const filteredSkills = (skillsList || []).filter((s) => {
    if (!s || !s.name || !s.tags) return false; // Skip invalid skill objects
    return (
      !formData.skills.some(
        (fs) => fs.toLowerCase() === s.name.toLowerCase()
      ) &&
      (s.name.toLowerCase().includes(newSkill.toLowerCase()) ||
        (Array.isArray(s.tags) &&
          s.tags.some((t) => t.toLowerCase().includes(newSkill.toLowerCase()))))
    );
  });

  const handleSearchChange = (e) => {
    setNewSkill(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelectSkill = (skillName) => {
    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, skillName],
    }));
    setNewSkill("");
    setShowSuggestions(false);
  };

  const handleRemoveSkill = (skill) =>
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));

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
    // Map skill names to their corresponding _id values
    const skillIds = formData.skills
      .map((skillName) => {
        const skill = skillsList.find(
          (s) => s?.name && s.name.toLowerCase() === skillName.toLowerCase()
        );
        return skill ? skill._id : null;
      })
      .filter((id) => id !== null);

    const updatedFormData = { ...formData, skills: skillIds };
    const ok = await updateUserProfile(updatedFormData);
    if (ok) {
      setProfile((prev) => ({
        ...prev,
        ...formData,
        skills: formData.skills.map((name) => ({ name })), // Update profile.skills to match formData
      }));
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
                  profile.availability?.status === "available"
                    ? "success"
                    : "danger"
                }
                className="me-2"
              >
                <FaCheckCircle />{" "}
                {profile.availability?.status === "available"
                  ? "Available"
                  : "Busy"}
              </Badge>
              {profile.availability?.willingToJoin && (
                <Badge bg="info" className="me-2">
                  Open to opportunities
                </Badge>
              )}
              <Badge bg="warning">
                <FaCalendarAlt /> {profile.yearOfExperience || 0} yrs
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
                Duration: {profile.expectedWorkDuration?.min || 0}–
                {profile.expectedWorkDuration?.max || 0}{" "}
                {profile.expectedWorkDuration?.unit || "hours"}
              </p>
              <p>Status: {profile.availability?.status || "available"}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="profile-card">
            <Card.Header>Skills</Card.Header>
            <Card.Body>
              {profile.skills?.length ? (
                profile.skills.map((s, i) => {
                  const skillObj = skillsList.find(
                    (sk) =>
                      sk?.name && sk.name.toLowerCase() === s.name.toLowerCase()
                  );
                  return (
                    <Badge bg="secondary" key={i} className="me-1 mb-1">
                      {renderIcon(skillObj?.icon || "")}
                      <span>{skillObj?.name || s.name}</span>
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
                  <Form.Label>Min</Form.Label>
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
                  <Form.Label>Max</Form.Label>
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
                          !newSkill.trim() ||
                          !skillsList.find(
                            (s) =>
                              s?.name &&
                              s.name.toLowerCase() ===
                                newSkill.trim().toLowerCase()
                          )
                        }
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const match = skillsList.find(
                            (s) =>
                              s?.name &&
                              s.name.toLowerCase() ===
                                newSkill.trim().toLowerCase()
                          );
                          if (match) handleSelectSkill(match.name);
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
                            onMouseDown={() => handleSelectSkill(s.name)}
                          >
                            <div>
                              {renderIcon(s.icon || "")}
                              <span className="ms-1">{s.name}</span>
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
                    {formData.skills.map((s, i) => (
                      <Badge bg="secondary" key={i} className="me-1 mb-1">
                        {renderIcon(
                          skillsList.find((sk) => sk?.name === s)?.icon || ""
                        )}
                        {s}{" "}
                        <FaTimes
                          style={{ cursor: "pointer" }}
                          onClick={() => handleRemoveSkill(s)}
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
