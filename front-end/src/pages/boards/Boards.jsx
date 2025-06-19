import React, { useEffect, useState } from 'react';
import { useCommon } from '../../contexts/CommonContext';
import { useParams, useNavigate } from 'react-router-dom';
import {
	Container,
	Breadcrumb,
	Row,
	Col,
	Card,
	Button,
	Spinner,
	Alert,
	Image,
	Badge,
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { MdPerson, MdChecklist } from 'react-icons/md';
import CreateBoardModal from './CreateBoardModal';
import UpdateBoardModal from './UpdateBoardModal';

const Boards = () => {
	const { workspaceId } = useParams();
	const navigate = useNavigate();
	const {
		boards,
		loadingBoards,
		boardsError,
		fetchBoards,
		setCurrentWorkspaceId,
		workspaces,
	} = useCommon();

	const [showCreate, setShowCreate] = useState(false);
	const [editingBoard, setEditingBoard] = useState(null);

	// Load boards khi vào trang
	useEffect(() => {
		setCurrentWorkspaceId(workspaceId);
		fetchBoards(workspaceId);
	}, [workspaceId]);

	// Tìm workspace hiện tại để hiển thị breadcrumb + check quyền
	const currentWs = workspaces.find((w) => String(w._id) === workspaceId);
	const creatorId = currentWs?.creator?._id || currentWs?.creator;
	const currentUserId = JSON.parse(localStorage.getItem('userData'))?._id;
	const isCreator = String(creatorId) === String(currentUserId);

	if (loadingBoards) {
		return (
			<Container className='py-4 text-center'>
				<Spinner animation='border' />
			</Container>
		);
	}
	if (boardsError) {
		return (
			<Container className='py-4'>
				<Alert variant='danger'>{boardsError}</Alert>
			</Container>
		);
	}

	return (
		<Container className='py-4'>
			{/* Breadcrumb + New Board */}
			<div className='d-flex justify-content-between align-items-center mb-3'>
				<Breadcrumb className='mb-0'>
					<Breadcrumb.Item linkAs={Link} linkProps={{ to: '/workspaces' }}>
						Workspaces
					</Breadcrumb.Item>
					<Breadcrumb.Item
						linkAs={Link}
						linkProps={{ to: `/workspace/${workspaceId}/boards` }}>
						Boards
					</Breadcrumb.Item>
					<Breadcrumb.Item active>{currentWs?.name}</Breadcrumb.Item>
				</Breadcrumb>

				{isCreator && (
					<Button variant='success' onClick={() => setShowCreate(true)}>
						+ New Board
					</Button>
				)}
			</div>

			<h2 className='mb-4'>Boards</h2>
			{boards.length === 0 && (
				<Alert variant='info'>Chưa có board nào trong workspace này.</Alert>
			)}

			{editingBoard && (
				<UpdateBoardModal
					show={!!editingBoard}
					onHide={() => setEditingBoard(null)}
					workspaceId={workspaceId}
					board={editingBoard}
					onUpdated={(updated) => {
						// cập nhật lại state boards
						fetchBoards(workspaceId);
						setEditingBoard(null);
					}}
				/>
			)}

			{/* Modal tạo board */}
			<CreateBoardModal
				show={showCreate}
				onHide={() => setShowCreate(false)}
				workspaceId={workspaceId}
				onCreated={() => {
					setShowCreate(false);
					fetchBoards(workspaceId);
				}}
			/>

			{/* Danh sách board */}
			<Row xs={1} md={2} lg={3} className='g-4'>
				{boards.map((board) => {
					const members = board.members || [];
					const displayMems = members.slice(0, 3);
					const moreCount = members.length > 3 ? members.length - 3 : 0;
					const listsCount = board.lists?.length ?? 0;

					return (
						<Col key={board._id}>
							<Card
								className='h-100 shadow-sm d-flex flex-column'
								style={{ cursor: 'pointer' }}
								onClick={() => navigate(`/boards/${board._id}`)}>
								{/* HEADER */}
								<Card.Header
									className='d-flex justify-content-between align-items-center '
									style={{
										height: '80px', // bắt header đều 100px
										overflow: 'hidden', // hide nếu title quá dài
										padding: '1rem', // giữ padding mặc định
									}}>
									<Col xs={8}>
										<h5 className='mb-0'>{board.name}</h5>
									</Col>

									<Col
										xs={4}
										className='d-flex justify-content-end align-items-center'>
										<Badge bg='secondary' pill>
											{board.visibility}
										</Badge>
									</Col>
								</Card.Header>

								{/* BODY */}
								<Card.Body className='d-flex flex-column p-3'>
									{/* 1) DESCRIPTION */}
									<div
										className='mb-3'
										style={{
											minHeight: '80px', // cố định chiều cao cho phần miêu tả
											overflow: 'hidden',
										}}>
										<Card.Text className='text-muted mb-0'>
											{board.description || ''}
										</Card.Text>
									</div>

									{/* 2) AVATARS */}
									<div className='d-flex mb-3'>
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
													className='me-2 rounded-circle bg-secondary text-white 
                     d-flex align-items-center justify-content-center'
													style={{ width: 40, height: 40, fontSize: '1rem' }}>
													{initial}
												</div>
											);
										})}
										{moreCount > 0 && (
											<div
												className='rounded-circle bg-light text-muted 
                   d-flex align-items-center justify-content-center'
												style={{ width: 40, height: 40 }}>
												+{moreCount}
											</div>
										)}
									</div>

									{/* 3) COUNTS */}
									<div className='d-flex justify-content-evenly mb-3'>
										<div className='d-flex align-items-center'>
											<MdPerson className='me-1' /> {members.length}
										</div>
										<div className='d-flex align-items-center'>
											<MdChecklist className='me-1' /> {listsCount}
										</div>
									</div>

									{/* 4) INVITE BUTTON */}
									<div className='mt-auto'>
										<Button
											variant='outline-primary'
											className='w-100'
											onClick={(e) => {
												e.stopPropagation();
												// đặt logic invite vào đây
											}}>
											Invite
										</Button>
									</div>
								</Card.Body>

								{/* FOOTER */}
								<Card.Footer className='bg-white border-0'>
									<Button
										variant='outline-warning'
										className='w-100'
										onClick={(e) => {
											e.stopPropagation();
											setEditingBoard(board);
										}}>
										Edit
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

export default Boards;
