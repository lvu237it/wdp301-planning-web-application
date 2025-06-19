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
	board, // object { _id, name, description, visibility, criteria }
	onUpdated, // callback(updatedBoard)
}) => {
	const { apiBaseUrl, accessToken, toast } = useCommon();

	// form state, khởi từ board khi modal mở
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [visibility, setVisibility] = useState('public');
	const [skillsOptions, setSkillsOptions] = useState([]);
	const [selectedSkills, setSelectedSkills] = useState([]);
	const [expMin, setExpMin] = useState('');
	const [expMax, setExpMax] = useState('');
	const [durMin, setDurMin] = useState('');
	const [durMax, setDurMax] = useState('');
	const [durUnit, setDurUnit] = useState('months');
	const [loading, setLoading] = useState(false);

	// Mỗi khi modal show hoặc board thay đổi, sync vào state
	useEffect(() => {
		if (show && board) {
			setName(board.name);
			setDescription(board.description || '');
			setVisibility(board.visibility);
			// criteria có dạng { skills, yearOfExperience, workDuration }
			const { criteria } = board;
			setSelectedSkills(
				(criteria?.skills || []).map((v) => ({ label: v, value: v }))
			);
			setExpMin(criteria?.yearOfExperience?.min?.toString() || '');
			setExpMax(criteria?.yearOfExperience?.max?.toString() || '');
			setDurMin(criteria?.workDuration?.min?.toString() || '');
			setDurMax(criteria?.workDuration?.max?.toString() || '');
			setDurUnit(criteria?.workDuration?.unit || 'months');
		}
	}, [show, board]);

	// Load skills options từ BE khi modal mở
	useEffect(() => {
		if (!show) return;
		const loadSkills = async () => {
			try {
				const res = await axios.get(`${apiBaseUrl}/skills`, {
					headers: { Authorization: `Bearer ${accessToken}` },
				});
				setSkillsOptions(res.data.skills || []);
			} catch (err) {
				console.error('Không tải được skills:', err);
			}
		};
		loadSkills();
	}, [show]);

	// Cho phép thêm skill mới tạm thời vào list
	const handleCreateSkill = (inputValue) => {
		const newOpt = { label: inputValue, value: inputValue.toLowerCase() };
		setSkillsOptions((prev) => [...prev, newOpt]);
		setSelectedSkills((prev) => [...prev, newOpt]);
	};

	// Validation & submit
	const handleSubmit = async (e) => {
		e.preventDefault();

		// client-side validate name <=25
		if (!name.trim()) {
			toast.error('Tên board không được để trống');
			return;
		}
		if (name.length > 25) {
			toast.error('Tên board tối đa 25 ký tự');
			return;
		}

		setLoading(true);
		const payload = {
			name: name.trim(),
			description: description.trim(),
			visibility,
			criteria: {
				skills: selectedSkills.map((s) => s.value),
				yearOfExperience: {
					min: Number(expMin) || 0,
					max: Number(expMax) || 0,
				},
				workDuration: {
					min: Number(durMin) || 0,
					max: Number(durMax) || 0,
					unit: durUnit,
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
					{/* NAME */}
					<Form.Group className='mb-3'>
						<Form.Label>Board Name</Form.Label>
						<Form.Control
							type='text'
							value={name}
							maxLength={25}
							onChange={(e) => setName(e.target.value)}
							required
						/>
						<Form.Text muted>{name.length}/25 characters</Form.Text>
					</Form.Group>

					{/* DESCRIPTION */}
					<Form.Group className='mb-3'>
						<Form.Label>Description</Form.Label>
						<Form.Control
							as='textarea'
							rows={3}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
                            maxLength={90}
						/>
						<Form.Text muted>{description.length}/90 characters</Form.Text>
					</Form.Group>

					{/* VISIBILITY */}
					<Form.Group className='mb-3'>
						<Form.Label>Visibility</Form.Label>
						<Form.Select
							value={visibility}
							onChange={(e) => setVisibility(e.target.value)}>
							<option value='public'>Public</option>
							<option value='private'>Private</option>
						</Form.Select>
					</Form.Group>

					{/* SKILLS */}
					<Form.Group className='mb-3'>
						<Form.Label>Required Skills</Form.Label>
						<CreatableSelect
							isMulti
							options={skillsOptions}
							value={selectedSkills}
							onChange={setSelectedSkills}
							onCreateOption={handleCreateSkill}
							placeholder='Select or type to add skills...'
						/>
					</Form.Group>

					{/* EXPERIENCE */}
					<Row className='mb-3'>
						<Form.Group as={Col}>
							<Form.Label>Exp. Min (yrs)</Form.Label>
							<Form.Control
								type='number'
								min={0}
								value={expMin}
								onChange={(e) => setExpMin(e.target.value)}
							/>
						</Form.Group>
						<Form.Group as={Col}>
							<Form.Label>Exp. Max (yrs)</Form.Label>
							<Form.Control
								type='number'
								min={0}
								value={expMax}
								onChange={(e) => setExpMax(e.target.value)}
							/>
						</Form.Group>
					</Row>

					{/* DURATION */}
					<Row className='mb-3'>
						<Form.Group as={Col}>
							<Form.Label>Duration Min</Form.Label>
							<Form.Control
								type='number'
								min={0}
								value={durMin}
								onChange={(e) => setDurMin(e.target.value)}
							/>
						</Form.Group>
						<Form.Group as={Col}>
							<Form.Label>Duration Max</Form.Label>
							<Form.Control
								type='number'
								min={0}
								value={durMax}
								onChange={(e) => setDurMax(e.target.value)}
							/>
						</Form.Group>
						<Form.Group as={Col}>
							<Form.Label>Unit</Form.Label>
							<Form.Select
								value={durUnit}
								onChange={(e) => setDurUnit(e.target.value)}>
								<option value='days'>Days</option>
								<option value='weeks'>Weeks</option>
								<option value='months'>Months</option>
								<option value='years'>Years</option>
							</Form.Select>
						</Form.Group>
					</Row>
				</Modal.Body>

				<Modal.Footer>
					<Button variant='secondary' onClick={onHide} disabled={loading}>
						Cancel
					</Button>
					<Button type='submit' variant='primary' disabled={loading}>
						{loading ? (
							<Spinner animation='border' size='sm' />
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
