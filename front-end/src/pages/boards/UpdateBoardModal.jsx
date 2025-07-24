// src/pages/workspaces/UpdateBoardModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import CreatableSelect from 'react-select/creatable';
import { useCommon } from '../../contexts/CommonContext';

const UpdateBoardModal = ({
  show,
  onHide,
  workspaceId,
  board, // { _id, name, description, visibility, criteria }
  onUpdated, // callback(updatedBoard)
}) => {
  const { apiBaseUrl, accessToken, toast } = useCommon();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [skillsOptions, setSkillsOptions] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [expMin, setExpMin] = useState('');
  const [expMax, setExpMax] = useState('');
  // ** date fields **
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);

  // sync khi mở modal hoặc board thay đổi
  useEffect(() => {
    if (show && board) {
      setName(board.name);
      setDescription(board.description || '');
      setVisibility(board.visibility);
      const crit = board.criteria || {};
      setSelectedSkills(
        (crit.skills || []).map((v) => ({
          label: v,
          value: v,
        }))
      );
      setExpMin(crit.yearOfExperience?.min?.toString() || '');
      setExpMax(crit.yearOfExperience?.max?.toString() || '');
      // ** chuyển sang date string YYYY-MM-DD **
      setStartDate(
        crit.workDuration?.startDate
          ? new Date(crit.workDuration.startDate).toISOString().slice(0, 10)
          : ''
      );
      setEndDate(
        crit.workDuration?.endDate
          ? new Date(crit.workDuration.endDate).toISOString().slice(0, 10)
          : ''
      );
    }
  }, [show, board]);

  useEffect(() => {
    if (!show) return;
    axios
      .get(`${apiBaseUrl}/skills`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => setSkillsOptions(res.data.skills || []))
      .catch(() => toast.error('Error fetching skills'));
  }, [show]);

  const handleCreateSkill = (inputValue) => {
    const newOpt = { label: inputValue, value: inputValue.toLowerCase() };
    setSkillsOptions((prev) => [...prev, newOpt]);
    setSelectedSkills((prev) => [...prev, newOpt]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name,
      description,
      visibility,
      criteria: {
        skills: selectedSkills.map((s) => s.value),
        yearOfExperience: {
          min: Number(expMin) || 0,
          max: Number(expMax) || 0,
        },
        workDuration: {
          startDate,
          endDate,
        },
      },
    };

    try {
      const res = await axios.put(
        `${apiBaseUrl}/workspace/${workspaceId}/board/${board._id}`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status === 200) {
        toast.success('Board updated successfully!');
        onHide();
        onUpdated?.(res.data.board);
      } else {
        toast.error(res.data.message || 'Failed to update board');
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
          <Modal.Title>Edit Board</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Name */}
          <Form.Group className='mb-3'>
            <Form.Label>Board Name</Form.Label>
            <Form.Control
              type='text'
              value={name}
              maxLength={25}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Form.Text muted>{name.length}/25</Form.Text>
          </Form.Group>
          {/* Description */}
          <Form.Group className='mb-3'>
            <Form.Label>Description</Form.Label>
            <Form.Control
              as='textarea'
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={90}
            />
            <Form.Text muted>{description.length}/90</Form.Text>
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
          {/* Date pickers */}
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
          <Button variant='primary' type='submit' disabled={loading}>
            {loading ? (
              <Spinner size='sm' animation='border' />
            ) : (
              'Save Changes'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default UpdateBoardModal;
