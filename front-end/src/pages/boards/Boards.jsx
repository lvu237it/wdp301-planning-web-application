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
import InviteBoardModal from './InviteBoardModal';
import { FaTrash } from 'react-icons/fa';

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
		closeBoard,
		deleteBoard,
	} = useCommon();

	const [showCreate, setShowCreate] = useState(false);
	const [editingBoard, setEditingBoard] = useState(null);
	const [inviteBoardId, setInviteBoardId] = useState(null);

	// Load boards khi vào trang
	useEffect(() => {
		setCurrentWorkspaceId(workspaceId);
		fetchBoards(workspaceId);
	}, [workspaceId]);

	// Tìm workspace hiện tại để hiển thị breadcrumb + check quyền
	const currentWs = workspaces.find((w) => String(w._id) === workspaceId);
	const wsMembers = currentWs?.members || []; //lấy ra các user nằm trong workspace
	const creatorId = currentWs?.creator?._id || currentWs?.creator;
	const currentUserId =
		JSON.parse(localStorage.getItem('userData'))?.id ||
		JSON.parse(localStorage.getItem('userData'))?._id;
	const isCreator = String(creatorId) === String(currentUserId);

	const handleDelete = async (e, board) => {
		e.stopPropagation();
		if (!window.confirm('Xác nhận xóa vĩnh viễn board này?')) return;
		try {
			await deleteBoard(workspaceId, board._id);
			await fetchBoards(workspaceId);
		} catch {}
	};

	if (loadingBoards) {
		return (
			<div className='boards-page'>
				<div className='boards-loading'>
					<Spinner animation='border' />
				</div>
			</div>
		);
	}

	if (boardsError) {
		return (
			<div className='boards-page'>
				<Container className='py-5'>
					<Alert variant='danger' className='boards-alert error'>
						{boardsError}
					</Alert>
				</Container>
			</div>
		);
	}

	return (
		<div className='boards-page'>
			<div className='boards-header'>
				<div className='container'>
					<div className='boards-header-content'>
						{/* Breadcrumb */}
						<Breadcrumb className='boards-breadcrumb'>
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

						{/* Title & Create Button */}
						<div className='boards-title-section'>
							<Col>
							<h1 className='boards-title'>Project Boards</h1>
							</Col>
							
							<Col style={{ display:"flex", justifyContent:"flex-end" }}>
							{/* NEW: Hiển thị avatar của tất cả thành viên workspace */}
							{wsMembers.length > 0 && (
								<div className='board-members' style={{marginRight:"30px"}}>
									{wsMembers.slice(0, 5).map((m) => {
										const user = m.userId;
										const avatar = user.avatar;
										const initial = user.username?.[0]?.toUpperCase() || '';
										return avatar ? (
											<Image
												key={user._id}
												src={avatar}
												roundedCircle
												width={32}
												height={32}
												className='me-1'
											/>
										) : (
											<div
												key={user._id}
												className='board-member-avatar-placeholder'
												style={{
													width: 32,
													height: 32,	
													borderRadius: '50%',
													fontSize: '0.9rem',
												}}>
												{initial}
											</div>
										);
									})}

									{wsMembers.length > 5 && (
										<div
											className='board-member-avatar-placeholder'
											style={{
												width: 32,
												height: 32,
												borderRadius: '50%',
												fontSize: '0.9rem',
											}}>
											+{wsMembers.length - 5}
										</div>
									)}
								</div>
							)}

							{isCreator && (
								<Button
									variant='success'
									className='btn-create-board'
									onClick={() => setShowCreate(true)}>
									+ New Board
								</Button>
							)}
							</Col>
							
						</div>
					</div>
				</div>
			</div>

			<div className='boards-content'>
				<Container className='py-4'>
					{/* Modals */}
					{editingBoard && (
						<UpdateBoardModal
							show={!!editingBoard}
							onHide={() => setEditingBoard(null)}
							workspaceId={workspaceId}
							board={editingBoard}
							onUpdated={(updated) => {
								fetchBoards(workspaceId);
								setEditingBoard(null);
							}}
						/>
					)}

					<CreateBoardModal
						show={showCreate}
						onHide={() => setShowCreate(false)}
						workspaceId={workspaceId}
						onCreated={() => {
							setShowCreate(false);
							fetchBoards(workspaceId);
						}}
					/>

					{inviteBoardId && (
						<InviteBoardModal
							show={!!inviteBoardId}
							onHide={() => setInviteBoardId(null)}
							workspaceId={workspaceId}
							boardId={inviteBoardId}
							onInvited={() => {
								setInviteBoardId(null);
								fetchBoards(workspaceId);
							}}
						/>
					)}

					{/* Empty State */}
					{boards.length === 0 && (
						<Alert variant='info' className='boards-empty-alert'>
							Chưa có board nào trong workspace này.
						</Alert>
					)}

					{/* Empty State */}
					{boards.length === 0 && (
						<Alert variant='info' className='boards-empty-alert'>
							Chưa có board nào trong workspace này.
						</Alert>
					)}

					{/* Boards Grid */}
					<Row xs={1} md={2} lg={3} className='g-4'>
						{boards.map((board) => {
							const members = board.members || [];
							const displayMems = members.slice(0, 3);
							const moreCount = members.length > 3 ? members.length - 3 : 0;
							const listsCount = board.lists?.length ?? 0;
							const isBoardAdmin = members.some(
								(m) =>
									String(m.userId?._id) === String(currentUserId) &&
									m.role === 'admin'
							);
							const canDelete = isCreator;
							const canManage = isBoardAdmin || isCreator;
							const handleClose = async (e) => {
								e.stopPropagation();
								if (!window.confirm('Bạn có muốn đóng board này?')) return;
								try {
									await closeBoard(workspaceId, board._id);
									fetchBoards(workspaceId);
								} catch {}
							};

							return (
								<Col key={board._id}>
									<Card
										className='board-card h-100 d-flex flex-column'
										onClick={() =>
											navigate(`/workspace/${workspaceId}/boards/${board._id}`)
										}>
										{/* HEADER */}
										<Card.Header className='board-card-header'>
											<div className='board-card-title-section'>
												<Card.Title className='board-card-title'>
													{board.name}
												</Card.Title>
											</div>
											<div className='board-card-badge-section'>
												<Badge
													pill
													className={`board-badge ${board.visibility}`}>
													{board.visibility}
												</Badge>
											</div>
											{canDelete && (
												<FaTrash
													className='workspace-delete-btn'
													onClick={(e) => {
														e.stopPropagation();
														handleDelete(e, board);
													}}
												/>
											)}
										</Card.Header>

										{/* BODY */}
										<Card.Body className='board-card-body flex-grow-1 d-flex flex-column'>
											{/* Description */}
											{board.description && (
												<Card.Text className='board-description'>
													{board.description}
												</Card.Text>
											)}

											{/* Stats */}
											<div className='board-stats'>
												<div className='board-stat-item'>
													<MdPerson className='board-stat-icon' />
													<span>{members.length} Members</span>
												</div>
												<div className='board-stat-item'>
													<MdChecklist className='board-stat-icon' />
													<span>{listsCount} Lists</span>
												</div>
											</div>

											{/* Members Avatars */}
											<div className='board-members'>
												{displayMems.map((m, i) => {
													const avatar = m.userId?.avatar;
													const initial = m.username?.[0]?.toUpperCase() || '';
													return avatar ? (
														<Image
															key={i}
															src={avatar}
															className='board-member-avatar'
														/>
													) : (
														<div
															key={i}
															className='board-member-avatar-placeholder'>
															{initial}
														</div>
													);
												})}
												{moreCount > 0 && (
													<div className='board-member-more'>+{moreCount}</div>
												)}
											</div>
										</Card.Body>

										{/* FOOTER */}

										{canManage && (
											<Card.Footer className='board-card-footer'>
												<>
													<Button
														variant='outline-primary'
														className='board-action-btn'
														onClick={(e) => {
															e.stopPropagation();
															setInviteBoardId(board._id);
														}}>
														Invite
													</Button>

													<Button
														variant='outline-danger'
														className='board-action-btn'
														onClick={(e) => {
															e.stopPropagation();
															handleClose(e);
														}}>
														Close
													</Button>

													<Button
														variant='outline-warning'
														className='board-action-btn'
														onClick={(e) => {
															e.stopPropagation();
															setEditingBoard(board);
														}}>
														Edit
													</Button>
												</>
											</Card.Footer>
										)}
									</Card>
								</Col>
							);
						})}
					</Row>
				</Container>
			</div>
		</div>
	);
};

export default Boards;
