import React, { useEffect } from 'react';
import { useCommon } from '../../contexts/CommonContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
	Container,
	Row,
	Col,
	Card,
	Button,
	Spinner,
	Alert,
	Image,
} from 'react-bootstrap';
import { MdPerson, MdChecklist } from 'react-icons/md';

const Boards = () => {
	const { workspaceId } = useParams();
	const navigate = useNavigate();
	const {
		boards,
		loadingBoards,
		boardsError,
		fetchBoards,
		setCurrentWorkspaceId,
	} = useCommon();

	useEffect(() => {
		fetchBoards(workspaceId);
		setCurrentWorkspaceId(workspaceId);
	}, [workspaceId]);

	if (loadingBoards)
		return (
			<Container className='py-4 text-center'>
				<Spinner animation='border' />
			</Container>
		);
	if (boardsError)
		return (
			<Container className='py-4'>
				<Alert variant='danger'>{boardsError}</Alert>
			</Container>
		);

	return (
		<Container className='py-4'>
			<div className='d-flex justify-content-between align-items-center mb-4'>
				<div className='mt-3'>
					<Breadcrumb className='mb-4'>
						<Breadcrumb.Item
							linkAs={Link}
							linkProps={{
								to: '/workspaces',
								// style cho thẻ <a> bên trong
								style: {
									color: 'gray',
									cursor: 'pointer',
									textDecoration: 'none',
								},
								// hoặc className: 'text-secondary'
							}}>
							Workspaces
						</Breadcrumb.Item>
						<Breadcrumb.Item active style={{ fontWeight: 'bold' }}>Boards</Breadcrumb.Item>
					</Breadcrumb>

					{/* ... phần content còn lại ... */}
				</div>

				<Button variant='success'>+ New Board</Button>
			</div>
			<h1>Boards</h1>
			<Row>
				{boards.map((board) => {
					// avatar handling
					const members = board.members;
					const displayMems = members.slice(0, 3);
					const moreCount = members.length > 3 ? members.length - 3 : 0;

					return (
						<Col key={board._id} md={6} lg={4} className='mb-4'>
							<Card className='h-100 shadow-sm'>
								<Card.Body className='d-flex flex-column'>
									{/* Title & desc */}
									<div>
										<Card.Title>{board.name}</Card.Title>
										<Card.Text className='text-muted'>
											{board.description}
										</Card.Text>
									</div>

									{/* Avatars */}
									<div className='d-flex mb-3 mt-3'>
										{displayMems.map((m, i) => {
											const avatar = m.userId?.avatar;
											const initial = m.username?.[0]?.toUpperCase() || '';
											return avatar ? (
												<Image
													key={i}
													src={avatar}
													roundedCircle
													width={40}
													height={40}
													className='me-2'
												/>
											) : (
												<div
													key={i}
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

									{/* Counts */}
									<div className='mt-auto d-flex align-items-center mb-3'>
										<div className='d-flex align-items-center me-4'>
											<MdPerson className='me-1' /> {members.length}
										</div>
										<div className='d-flex align-items-center'>
											<MdChecklist className='me-1' />{' '}
											{board.tasks?.length ?? 0}
										</div>
									</div>

									{/* Invite */}
									<Button variant='outline-primary'>Invite</Button>
								</Card.Body>
							</Card>
						</Col>
					);
				})}
			</Row>
		</Container>
	);
};

export default Boards;
