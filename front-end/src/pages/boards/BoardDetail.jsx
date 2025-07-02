// src/pages/boards/BoardDetail.jsx
import { useParams } from 'react-router-dom';
import React, { useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import List from '../lists/List';
import { useCommon } from '../../contexts/CommonContext';
import { Image } from 'react-bootstrap';
const BoardDetail = () => {
	const { workspaceId, boardId } = useParams();
	const {
		setCurrentWorkspaceId,
		navigate,
		getBoardCalendar,
		calendarBoard,
		setCalendarBoard,
		fetchBoards,
		boards,
	} = useCommon();
	// console.log('boards', boards);
	// 1) Khi mount hoặc đổi workspaceId, set và fetch boards
	useEffect(() => {
		if (workspaceId) {
			setCurrentWorkspaceId(workspaceId);
			fetchBoards(workspaceId);
		}
	}, [workspaceId]);

	useEffect(() => {
		if (workspaceId) {
			setCurrentWorkspaceId(workspaceId);
		}
	}, [workspaceId, setCurrentWorkspaceId]);

	useEffect(() => {
		if (boardId) {
			//Lấy calendar của board, nếu không tìm thấy thì tự động tạo mới
			getBoardCalendar(boardId);
		}
	}, [boardId]);

	// Make toast available globally for List component
	useEffect(() => {
		window.toast = toast;
		return () => {
			delete window.toast;
		};
	}, []);

	const currentBoard = boards.find((b) => String(b._id) === boardId);
	const boardMembers = currentBoard?.members || [];
	// console.log('boardMembers', boardMembers);

	return (
		<div className='board-detail-page'>
			<div className='board-detail-header'>
				<div className='container d-flex justify-content-between'>
					<h2 className='board-title'>List of boards</h2>

					{/* Hiển thị tối đa 5 thành viên với chữ cái đầu */}
					{boardMembers.length > 0 && (
						<div className='board-members d-flex align-items-center'>
							{boardMembers.slice(0, 5).map((m) => {
								const initial = m.username?.[0]?.toUpperCase() || '';
								return (
									<div
										key={m._id}
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
							{boardMembers.length > 5 && (
								<div
									className='d-flex justify-content-center align-items-center bg-secondary text-white'
									style={{
										width: 32,
										height: 32,
										borderRadius: '50%',
										fontSize: '0.9rem',
									}}>
									+{members.length - 5}
								</div>
							)}
						</div>
					)}

					{/* <div
            className='btn-create-workspace btn btn-success'
            onClick={() => navigate(`/board-calendar/${boardId}`)}
          >
            View board's events
          </div> */}
				</div>
			</div>

			<div className='board-detail-content'>
				<div className='board-lists-container'>
					<List boardId={boardId} />
				</div>
			</div>
		</div>
	);
};

export default BoardDetail;
