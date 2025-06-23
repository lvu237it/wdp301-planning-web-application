// src/pages/workspaces/InviteBoardModal.jsx
import React, { useState } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useCommon } from '../../contexts/CommonContext';

const InviteBoardModal = ({
	show,
	onHide,
	boardId,
	workspaceId,
	onInvited,
}) => {
	const { apiBaseUrl, accessToken, toast } = useCommon();
	const [email, setEmail] = useState('');
	const [loading, setLoading] = useState(false);

	const handleHide = () => {
		setEmail('');
		onHide();
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			await axios.post(
				`${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}/invite`,
				{ email },
				{ headers: { Authorization: `Bearer ${accessToken}` } }
			);
			toast.success('Đã gửi lời mời thành công');
			onInvited();
			onHide();
		} catch (err) {
			toast.error(err.response?.data?.message || err.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal show={show} onHide={handleHide} centered>
			<Form onSubmit={handleSubmit}>
				<Modal.Header closeButton>
					<Modal.Title>Invite Member to Board</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Form.Group controlId='inviteEmail' className='mb-3'>
						<Form.Label>Email</Form.Label>
						<Form.Control
							type='email'
							placeholder='Enter user email'
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' onClick={handleHide} disabled={loading}>
						Cancel
					</Button>
					<Button type='submit' variant='primary' disabled={loading}>
						{loading ? <Spinner animation='border' size='sm' /> : 'Send Invite'}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal>
	);
};

export default InviteBoardModal;
