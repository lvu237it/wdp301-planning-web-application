// src/pages/workspaces/CreateBoardModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import CreatableSelect from 'react-select/creatable';
import { useCommon } from '../../contexts/CommonContext';

const CreateBoardModal = ({ show, onHide, workspaceId, onCreated }) => {
  const { apiBaseUrl, accessToken, toast } = useCommon();

  // form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [skillsOptions, setSkillsOptions] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [expMin, setExpMin] = useState('');
  const [expMax, setExpMax] = useState('');

  // ** CHỈ ĐỔI PHẦN này: from durMin/durMax/unit → startDate/endDate **
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    axios
      .get(`${apiBaseUrl}/skills`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => setSkillsOptions(res.data.data.skills || []))
      .catch(() => toast.error('Error fetching skills'));
  }, [show]);
  console.log('skill', skillsOptions);

  useEffect(() => {
    if (!show) {
      setName('');
      setDescription('');
      setVisibility('public');
      setSelectedSkills([]);
      setExpMin('');
      setExpMax('');
      // reset date fields
      setStartDate('');
      setEndDate('');
    }
  }, [show]);

  const handleCreateSkill = (inputValue) => {
    const newOpt = { label: inputValue, value: inputValue.toLowerCase() };
    setSkillsOptions((prev) => [...prev, newOpt]);
    setSelectedSkills((prev) => [...prev, newOpt]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const criteria = {
      skills: selectedSkills.map((s) => s.value),
      yearOfExperience: {
        min: Number(expMin) || 0,
        max: Number(expMax) || 0,
      },
      // chỉ gửi ngày
      workDuration: {
        startDate,
        endDate,
      },
    };

    try {
      const res = await axios.post(
        `${apiBaseUrl}/workspace/${workspaceId}/board/create`,
        { name, description, visibility, criteria },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status === 201) {
        toast.success('Board created successfully!');
        onHide();
        onCreated?.(res.data.board);
      } else {
        toast.error(res.data.message || 'Failed to create board');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size='lg' centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Board</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Board Name */}
          <Form.Group className='mb-3'>
            <Form.Label>Board Name</Form.Label>
            <Form.Control
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              required
            />
            <Form.Text muted>Character: {name.length}</Form.Text>
          </Form.Group>
          {/* Description */}
          <Form.Group className='mb-3'>
            <Form.Label>Description</Form.Label>
            <Form.Control
              as='textarea'
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Form.Text muted>Character: {description.length}</Form.Text>
          </Form.Group>
          {/* Visibility */}
          <Form.Group className='mb-3'>
            <Form.Label>Visibility</Form.Label>
            <Form.Select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value='public'>Public</option>
              <option value='private'>Private</option>
            </Form.Select>
          </Form.Group>
          {/* Skills */}
          <Form.Group className='mb-3'>
            <Form.Label>Required Skills</Form.Label>
            <CreatableSelect
              isMulti
              options={skillsOptions}
              value={selectedSkills}
              onChange={setSelectedSkills}
              onCreateOption={handleCreateSkill}
              placeholder='Select or add skills…'
            />
          </Form.Group>
          {/* Experience */}
          <Row className='mb-3'>
            <Col>
              <Form.Label>Exp. Min (yrs)</Form.Label>
              <Form.Control
                type='number'
                min={0}
                value={expMin}
                onChange={(e) => setExpMin(e.target.value)}
              />
            </Col>
            <Col>
              <Form.Label>Exp. Max (yrs)</Form.Label>
              <Form.Control
                type='number'
                min={0}
                value={expMax}
                onChange={(e) => setExpMax(e.target.value)}
              />
            </Col>
          </Row>
          {/* ** DATE PICKERS THAY CHO WORK DURATION ** */}
          <Row className='mb-3'>
            <Col>
              <Form.Label>Start Date</Form.Label>
              <Form.Control
                type='date'
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </Col>
            <Col>
              <Form.Label>End Date</Form.Label>
              <Form.Control
                type='date'
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={onHide} disabled={loading}>
            Cancel
          </Button>
          <Button variant='success' type='submit' disabled={loading}>
            {loading ? (
              <Spinner size='sm' animation='border' />
            ) : (
              'Create Board'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CreateBoardModal;
