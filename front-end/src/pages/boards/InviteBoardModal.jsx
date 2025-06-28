// src/pages/workspaces/InviteBoardModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Alert } from 'react-bootstrap';
import Select from 'react-select';
import axios from 'axios';
import { useCommon } from '../../contexts/CommonContext';

const InviteBoardModal = ({
	show,
	onHide,
	workspaceId,
	boardId,
	onInvited, // callback khi hoàn thành (để parent refresh lại danh sách thành viên)
}) => {
	const { apiBaseUrl, accessToken, toast } = useCommon();

	const [qualifiedOptions, setQualifiedOptions] = useState([]);
	const [selectedOptions, setSelectedOptions] = useState([]);
	const [loadingUsers, setLoadingUsers] = useState(false);
	const [inviting, setInviting] = useState(false);
	const [fetchError, setFetchError] = useState(null);

	// 1) Khi modal hiện lên, fetch danh sách qualified users
	useEffect(() => {
		if (!show) return;
		setLoadingUsers(true);
		setFetchError(null);

		axios
			.get(
				`${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}/qualified-users`,
				{ headers: { Authorization: `Bearer ${accessToken}` } }
			)
			.then((res) => {
				const opts = (res.data.users || []).map((u) => ({
					label: `${u.username} (${u.email})`,
					value: u.email,
				}));
				setQualifiedOptions(opts);
			})
			.catch((err) => {
				console.error('Fetch qualified users error:', err);
				setFetchError(
					err.response?.data?.message || 'Không lấy được danh sách users'
				);
			})
			.finally(() => setLoadingUsers(false));
	}, [show, workspaceId, boardId]);

	const handleHide = () => {
		setSelectedOptions([]);
		onHide();
	};

	// 2) Khi submit thì sẽ gọi invite endpoint
	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!selectedOptions.length) {
			toast.error('Chọn ít nhất một user');
			return;
		}
		setInviting(true);
		try {
			const emails = selectedOptions.map((o) => o.value);
			const res = await axios.post(
				`${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}/invite`,
				{ emails },
				{ headers: { Authorization: `Bearer ${accessToken}` } }
			);
			// bạn có thể inspect res.data.results để biết từng email ok/error
			toast.success('Đã gửi lời mời cho tất cả');
			onInvited?.();
			handleHide();
		} catch (err) {
			toast.error(err.response?.data?.message || err.message);
		} finally {
			setInviting(false);
		}
	};

	return (
		<Modal show={show} onHide={handleHide} centered>
			<Modal.Header closeButton>
				<Modal.Title>Invite Qualified Users to Board</Modal.Title>
			</Modal.Header>

			<Modal.Body>
				{loadingUsers ? (
					<div className='text-center py-4'>
						<Spinner animation='border' />
					</div>
				) : fetchError ? (
					<Alert variant='danger'>{fetchError}</Alert>
				) : qualifiedOptions.length === 0 ? (
					<Alert variant='info'>
						Không có user nào thỏa mãn tiêu chí của board này.
					</Alert>
				) : (
					<Select
						isMulti
						options={qualifiedOptions}
						value={selectedOptions}
						onChange={setSelectedOptions}
						placeholder='Chọn user để gửi lời mời…'
					/>
				)}
			</Modal.Body>

			<Modal.Footer>
				<Button variant='secondary' onClick={handleHide} disabled={inviting}>
					Cancel
				</Button>
				<Button
					variant='primary'
					onClick={handleSubmit}
					disabled={inviting || loadingUsers || qualifiedOptions.length === 0}>
					{inviting ? <Spinner animation='border' size='sm' /> : 'Send Invites'}
				</Button>
			</Modal.Footer>
		</Modal>
	);
};

export default InviteBoardModal;
