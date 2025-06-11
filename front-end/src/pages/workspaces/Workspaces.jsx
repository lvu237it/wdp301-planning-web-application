// src/pages/workspaces/Workspaces.jsx

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

const Workspaces = () => {
	const {
		workspaces,
		loadingWorkspaces,
		workspacesError,
		navigateToCreateWorkspace,
		setCurrentWorkspaceId,
	} = useCommon();
	const navigate = useNavigate();

	if (loadingWorkspaces) {
		return (
			<Container className='py-4 text-center'>
				<Spinner animation='border' role='status'>
					<span className='visually-hidden'>Loading...</span>
				</Spinner>
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
				<Button variant='success' onClick={navigateToCreateWorkspace}>
					+ New Workspace
				</Button>
			</div>

			<Row>
				{workspaces.map((ws) => {
					const totalMembers = ws.members.length;
					const moreCount = totalMembers > 3 ? totalMembers - 3 : 0;
					const displayMembers = ws.members.slice(0, 3);

					return (
						<Col
							key={ws._id}
							md={6}
							lg={4}
							className='mb-4'
							style={{ cursor: 'pointer' }}
							onClick={() => {
								// 1) lưu workspaceId
								setCurrentWorkspaceId(ws._id);
								// 2) chuyển sang boards
								navigate(`/workspace/${ws._id}/boards`);
							}}>
							<Card className='h-100 shadow-sm'>
								<Card.Body className='d-flex flex-column'>
									<div className='d-flex justify-content-between align-items-start'>
										<div>
											<Card.Title>{ws.name}</Card.Title>
											<Card.Text className='text-muted'>
												{ws.description}
											</Card.Text>
										</div>
										<Badge bg='success'>{ws.role}</Badge>
									</div>

									<div className='d-flex text-muted mb-3'>
										<div className='me-4 d-flex align-items-center'>
											<MdPeople className='me-1' /> {totalMembers} Members
										</div>
										<div className='d-flex align-items-center'>
											<MdDashboard className='me-1' /> {ws.boardsCount ?? 0}{' '}
											Boards
										</div>
									</div>

									<div className='d-flex mb-3'>
										{displayMembers.map((m, idx) => {
											const avatar = m.userId.avatar;
											const initial = m.userId.username.charAt(0).toUpperCase();

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
													className='me-2 rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center'
													style={{ width: 40, height: 40, fontSize: '1rem' }}>
													{initial}
												</div>
											);
										})}

										{moreCount > 0 && (
											<div
												className='d-flex align-items-center justify-content-center rounded-circle bg-light text-muted'
												style={{ width: 40, height: 40 }}>
												+{moreCount}
											</div>
										)}
									</div>

									<div className='mt-auto'>
										<Button
											variant='outline-primary'
											onClick={() => {
												/* Invite logic */
											}}>
											Invite
										</Button>
									</div>
								</Card.Body>
							</Card>
						</Col>
					);
				})}
			</Row>
		</Container>
	);
};

export default Workspaces;
