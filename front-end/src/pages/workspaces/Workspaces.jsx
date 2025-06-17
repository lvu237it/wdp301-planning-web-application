import React, { useState } from 'react';
import {
	Container,
	Row,
	Col,
	Card,
	Button,
	Badge,
	Image,
	Spinner,
	Alert,
} from 'react-bootstrap';
import { MdPeople, MdDashboard } from 'react-icons/md';
import { useCommon } from '../../contexts/CommonContext';
import { useNavigate } from 'react-router-dom';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import UpdateWorkspaceModal from './UpdateWorkspaceModal';
import InviteMemberModal from './InviteMemberWorkspace';
import { FaTrash } from 'react-icons/fa';

const Workspaces = () => {
	const {
		workspaces,
		loadingWorkspaces,
		workspacesError,
		setCurrentWorkspaceId,
		closeWorkspace,
		deleteWorkspace,
		toast,
	} = useCommon();
	const navigate = useNavigate();
	const stored = localStorage.getItem('userData');
	const currentUserId = stored ? JSON.parse(stored)._id : null;
	const [showCreate, setShowCreate] = useState(false);
	const [editingWs, setEditingWs] = useState(null);
	const [inviteWsId, setInviteWsId] = useState(null);

	const handleClose = async (e, wsId) => {
		e.stopPropagation();
		if (!window.confirm('Do you want to close this workspace?')) return;
		try {
			await closeWorkspace(wsId);
		} catch (err) {
			toast.error(err.message || 'Close workspace failed');
		}
	};

	const handleDelete = async (e, wsId) => {
		e.stopPropagation();
		if (!window.confirm('Do you want to delete this workspace forever?'))
			return;
		try {
			await deleteWorkspace(wsId);
		} catch (err) {
			toast.error(err.message || 'Delete workspace failed');
		}
	};

	if (loadingWorkspaces) {
		return (
			<Container className='py-4 text-center'>
				<Spinner animation='border' role='status' />
			</Container>
		);
	}

	if (workspacesError) {
		return (
			<Container className='py-4'>
				<Alert variant='danger'>Error: {workspacesError}</Alert>
			</Container>
		);
	}

	return (
		<Container className='py-4'>
			<div className='d-flex justify-content-between align-items-center mb-4'>
				<h1 className='mb-0'>My Workspaces</h1>
				<Button variant='success' onClick={() => setShowCreate(true)}>
					+ New Workspace
				</Button>
			</div>

			{/* Modal create */}
			<CreateWorkspaceModal
				show={showCreate}
				onHide={() => setShowCreate(false)}
			/>

			{/* Modal edit */}
			{editingWs && (
				<UpdateWorkspaceModal
					show={!!editingWs}
					workspace={editingWs}
					onHide={() => setEditingWs(null)}
				/>
			)}

			{/* Modal invite */}
			{inviteWsId && (
				<InviteMemberModal
					show={!!inviteWsId}
					workspaceId={inviteWsId}
					onHide={() => setInviteWsId(null)}
				/>
			)}

			{workspaces.length === 0 && (
				<Alert variant='info'>
					Bạn chưa có workspace nào. Hãy tạo mới ngay!
				</Alert>
			)}

			<Row xs={1} md={2} lg={3} className='g-4'>
				{workspaces.map((ws) => {
					// Chuẩn bị data
					const members = Array.isArray(ws.members) ? ws.members : [];
					const totalMembers = members.length;
					const displayMembers = members.slice(0, 3);
					const moreCount = totalMembers > 3 ? totalMembers - 3 : 0;
					const boardCount = ws.countBoard ?? 0;
					const creatorId = ws.creator?._id || ws.creator;
					const currentUserId = JSON.parse(
						localStorage.getItem('userData')
					)._id;
					const isCreator = String(creatorId) === String(currentUserId);

					return (
						<Col key={ws._id} style={{ cursor: 'pointer' }}
							onClick={() => {
								setCurrentWorkspaceId(ws._id);
								navigate(`/workspace/${ws._id}/boards`);
							}}>
							<Card className='h-100 d-flex flex-column shadow-sm'>
								{/* HEADER */}
								<Card.Header className='d-flex justify-content-between align-items-center h-100'>
									<Col xs={7}>
										<Card.Title className='mb-0'>{ws.name}</Card.Title>
									</Col>

									<Col xs={5}>
										<Badge pill bg='success'>
											{isCreator ? 'creatorWorkspace' : 'memberWorkspace'}
										</Badge>
										{isCreator && (
											<FaTrash
												className='text-danger ms-3'
												style={{ cursor: 'pointer' }}
												onClick={(e) => {
													e.stopPropagation();
													handleDelete(e, ws._id);
												}}
											/>
										)}
									</Col>
								</Card.Header>

								{/* BODY */}
								<Card.Body className='flex-grow-1 d-flex flex-column'>
									{ws.description && (
										<Card.Text className='text-muted mb-3'>
											{ws.description}
										</Card.Text>
									)}

									<div className='d-flex text-muted mb-3'>
										<div className='me-4 d-flex align-items-center'>
											<MdPeople className='me-1' /> {totalMembers} Members
										</div>
										<div className='d-flex align-items-center'>
											<MdDashboard className='me-1' /> {boardCount} Boards
										</div>
									</div>

									<div className='d-flex mb-3'>
										{displayMembers.map((m, idx) => {
											const user = m.userId || m;
											const avatar = user.avatar;
											const initial = (user.username || '')
												.charAt(0)
												.toUpperCase();
											return avatar ? (
												<Image
													key={idx}
													src={avatar}
													roundedCircle
													width={40}
													height={40}
													className='me-2'
												/>
											) : (
												<div
													key={idx}
													className='me-2 rounded-circle bg-secondary text-white
                               d-flex align-items-center justify-content-center'
													style={{ width: 40, height: 40, fontSize: '1rem' }}>
													{initial}
												</div>
											);
										})}
										{moreCount > 0 && (
											<div
												className='d-flex align-items-center justify-content-center
                             rounded-circle bg-light text-muted'
												style={{ width: 40, height: 40 }}>
												+{moreCount}
											</div>
										)}
									</div>
								</Card.Body>

								{/* FOOTER */}
								<Card.Footer className='bg-white border-0 d-flex justify-content-around'>
									<Button
										variant='outline-primary'
										onClick={(e) => {
											e.stopPropagation();
											setEditingWs(ws);
										}}>
										Edit
									</Button>
									<Button
										variant='outline-danger'
										onClick={(e) => {
											e.stopPropagation();
											handleClose(e, ws._id);
										}}>
										Close
									</Button>
									<Button
										variant='outline-secondary'
										onClick={(e) => {
											e.stopPropagation();
											setInviteWsId(ws._id);
										}}>
										Invite
									</Button>
								</Card.Footer>
							</Card>
						</Col>
					);
				})}
			</Row>
		</Container>
	);
};

export default Workspaces;
