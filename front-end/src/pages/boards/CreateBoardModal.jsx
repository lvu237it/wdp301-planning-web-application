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

	// options và selected của select skills
	const [skillsOptions, setSkillsOptions] = useState([]);
	const [selectedSkills, setSelectedSkills] = useState([]);

	const [expMin, setExpMin] = useState('');
	const [expMax, setExpMax] = useState('');
	const [durMin, setDurMin] = useState('');
	const [durMax, setDurMax] = useState('');
	const [durUnit, setDurUnit] = useState('months');
	const [loading, setLoading] = useState(false);

	// 1) Mỗi khi modal mở, fetch danh sách skills từ backend
	useEffect(() => {
		if (!show) return;
		const loadSkills = async () => {
			try {
				const res = await axios.get(`${apiBaseUrl}/skills`, {
					headers: { Authorization: `Bearer ${accessToken}` },
				});
				// giả sử API trả về { skills: [ { label, value }, ... ] }
				setSkillsOptions(res.data.skills || []);
			} catch (err) {
				console.error('Không tải được skills:', err);
				toast.error('Không lấy được danh sách kỹ năng');
			}
		};
		loadSkills();
	}, [show, apiBaseUrl, accessToken, toast]);

	// reset form khi modal đóng
	useEffect(() => {
		if (!show) {
			setName('');
			setDescription('');
			setVisibility('public');
			setSelectedSkills([]);
			setExpMin('');
			setExpMax('');
			setDurMin('');
			setDurMax('');
			setDurUnit('months');
		}
	}, [show]);

	// thêm skill mới chỉ trong local state
	const handleCreateSkill = (inputValue) => {
		const newOption = {
			label: inputValue,
			value: inputValue.toLowerCase(),
		};
		setSkillsOptions((prev) => [...prev, newOption]);
		setSelectedSkills((prev) => [...prev, newOption]);
	};

	// submit form tạo board
	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);

		const criteria = {
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
							maxLength={30} // ← giới hạn 25 ký tự
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
              maxLength={90}
						/>
            <Form.Text muted>Character: {description.length}</Form.Text>
					</Form.Group>

					{/* Visibility */}
					<Form.Group className='mb-3'>
						<Form.Label>Visibility</Form.Label>
						<Form.Select
							value={visibility}
							onChange={(e) => setVisibility(e.target.value)}>
							<option value='public'>Public</option>
							<option value='private'>Private</option>
						</Form.Select>
					</Form.Group>

					{/* Required Skills (fetch từ BE) */}
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

					{/* Experience */}
					<Row className='mb-3'>
						<Form.Group as={Col}>
							<Form.Label>Exp. Min (yrs)</Form.Label>
							<Form.Control
								type='number'
								value={expMin}
								min={0}
								onChange={(e) => setExpMin(e.target.value)}
							/>
						</Form.Group>
						<Form.Group as={Col}>
							<Form.Label>Exp. Max (yrs)</Form.Label>
							<Form.Control
								type='number'
								value={expMax}
								min={0}
								onChange={(e) => setExpMax(e.target.value)}
							/>
						</Form.Group>
					</Row>

					{/* Work Duration */}
					<Row className='mb-3'>
						<Form.Group as={Col}>
							<Form.Label>Duration Min</Form.Label>
							<Form.Control
								type='number'
								value={durMin}
								min={0}
								onChange={(e) => setDurMin(e.target.value)}
							/>
						</Form.Group>
						<Form.Group as={Col}>
							<Form.Label>Duration Max</Form.Label>
							<Form.Control
								type='number'
								value={durMax}
								min={0}
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
							'Create Board'
						)}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal>
	);
};

export default CreateBoardModal;
