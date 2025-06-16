import React, { useState, useEffect } from "react";
import { useCommon } from "../../contexts/CommonContext";
import "./profile.css";
import { FaCamera, FaEdit, FaMapMarkerAlt } from "react-icons/fa";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";

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

  // Load profile once
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
    const { name, value } = e.target;
    if (name.includes("availability.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        availability: { ...prev.availability, [field]: value },
      }));
    } else if (name.includes("expectedWorkDuration.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        expectedWorkDuration: {
          ...prev.expectedWorkDuration,
          [field]: field === "unit" ? value : Number(value),
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      availability: { ...prev.availability, [name]: checked },
    }));
  };

  const handleAddSkill = () => {
    const skill = newSkill.trim();
    if (skill && !formData.skills.includes(skill)) {
      setFormData((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
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
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload avatar");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await updateUserProfile(formData);
    if (success) {
      setProfile((prev) => ({ ...prev, ...formData }));
      setIsEditing(false);
    }
  };

  if (!profile) return <div className="loading-container">Loading...</div>;

  return (
    <div className={`profile-content ${isMobile ? "mobile" : ""}`}>
      <div className="profile-header">
        <div className="profile-avatar">
          <img
            src={profile.avatar || "https://via.placeholder.com/150"}
            alt="Avatar"
          />
          <label className="btn-edit-avatar">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              hidden
            />
            <FaCamera />
          </label>
        </div>
        <div className="profile-details-header">
          <h1>{profile.fullname}</h1>
          <div className="profile-subinfo">
            {profile.username && <span>@{profile.username}</span>}
            {profile.location && (
              <span>
                <FaMapMarkerAlt /> {profile.location}
              </span>
            )}
          </div>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <FaEdit /> Edit Profile
          </Button>
        </div>
      </div>

      {/* About, Skills, etc. as before */}
      <div className="profile-grid">
        {/* About Card */}
        <div className="profile-card">
          <div className="card-header">
            <h2>About</h2>
          </div>
          <div className="card-content">
            <p>{profile.about || "No description."}</p>
          </div>
        </div>
        {/* Skills */}
        <div className="profile-card">
          <div className="card-header">
            <h2>Skills</h2>
          </div>
          <div className="card-content skills-grid">
            {profile.skills.map((s, i) => (
              <div key={i} className="skill-item">
                <span>{s}</span>
              </div>
            )) || <p>No skills.</p>}
          </div>
        </div>
        {/* Experience */}
        <div className="profile-card">
          <div className="card-header">
            <h2>Experience</h2>
          </div>
          <div className="card-content">
            <p>{profile.experience || "No experience."}</p>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        show={isEditing}
        onHide={() => setIsEditing(false)}
        centered
        dialogClassName="custom-modal"
      >
        <Form onSubmit={handleSubmit} className="modal-content">
          <Modal.Header closeButton className="modal-header">
            <Modal.Title className="modal-title">Edit Profile</Modal.Title>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <Form.Group controlId="fullname" className="mb-3">
              <Form.Label>Full Name</Form.Label>
              <Form.Control
                type="text"
                name="fullname"
                value={formData.fullname}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group controlId="username" className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group controlId="email" className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group controlId="about" className="mb-3">
              <Form.Label>About</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="about"
                value={formData.about}
                onChange={handleInputChange}
              />
            </Form.Group>
            <Form.Group controlId="experience" className="mb-3">
              <Form.Label>Experience</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                name="experience"
                value={formData.experience}
                onChange={handleInputChange}
              />
            </Form.Group>
            <Row>
              <Col>
                <Form.Group controlId="yearOfExperience" className="mb-3">
                  <Form.Label>Years of Exp.</Form.Label>
                  <Form.Control
                    type="number"
                    name="yearOfExperience"
                    value={formData.yearOfExperience}
                    onChange={handleInputChange}
                    min={0}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="availability.status" className="mb-3">
                  <Form.Label>Availability</Form.Label>
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
            </Row>
            <Form.Group controlId="willingToJoin" className="mb-3 form-check">
              <Form.Check
                type="checkbox"
                label="Willing to Join"
                name="willingToJoin"
                checked={formData.availability.willingToJoin}
                onChange={handleCheckboxChange}
              />
            </Form.Group>
            <Row className="mb-3">
              <Col>
                <Form.Group controlId="expectedWorkDuration.min">
                  <Form.Label>Min Duration</Form.Label>
                  <Form.Control
                    type="number"
                    name="expectedWorkDuration.min"
                    value={formData.expectedWorkDuration.min}
                    onChange={handleInputChange}
                    min={0}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="expectedWorkDuration.max">
                  <Form.Label>Max Duration</Form.Label>
                  <Form.Control
                    type="number"
                    name="expectedWorkDuration.max"
                    value={formData.expectedWorkDuration.max}
                    onChange={handleInputChange}
                    min={0}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="expectedWorkDuration.unit">
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
            </Row>
            <Form.Group controlId="skills" className="mb-3">
              <Form.Label>Skills</Form.Label>
              <Row className="align-items-center">
                <Col>
                  <Form.Control
                    type="text"
                    value={newSkill}
                    placeholder="New skill"
                    onChange={(e) => setNewSkill(e.target.value)}
                  />
                </Col>
                <Col xs="auto">
                  <Button variant="secondary" onClick={handleAddSkill}>
                    Add
                  </Button>
                </Col>
              </Row>
              <div className="skills-list mt-2">
                {formData.skills.map((s) => (
                  <span key={s} className="skill-tag me-2">
                    {s}{" "}
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleRemoveSkill(s)}
                    >
                      ×
                    </Button>
                  </span>
                ))}
              </div>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="modal-footer">
            <Button variant="outline-light" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Profile;
