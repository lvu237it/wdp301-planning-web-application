// src/pages/boards/BoardDetail.jsx
import { useParams } from 'react-router-dom';
import React, { useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import List from '../lists/List';
import { useCommon } from '../../contexts/CommonContext';
const BoardDetail = () => {
  const { workspaceId, boardId } = useParams();
  const {
    setCurrentWorkspaceId,
    navigate,
    getBoardCalendar,
    calendarBoard,
    setCalendarBoard,
  } = useCommon();
  // useEffect(() => {
  //   if (workspaceId) {
  //     console.log('workspaceId in boardDetail', workspaceId);
  //     setCurrentWorkspaceId(workspaceId);
  //   }
  // }, [workspaceId]);

  // useEffect(() => {
  //   console.log('worspacekId', workspaceId);
  // }, []);

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

  return (
    <div className='board-detail-page'>
      <div className='board-detail-header'>
        <div className='container d-flex justify-content-between'>
          <h2 className='board-title'>List of boards</h2>
          {/* <div
            className='btn-create-workspace btn btn-success'
            onClick={() => navigate(`/board-calendar/${boardId}`)}
          >
            View board's events
          </div> */}

          <div
            className='btn-create-workspace btn btn-success'
            onClick={() =>
              navigate(
                `/workspace/${workspaceId}/boards/${boardId}/activity-log`
              )
            }
          >
            📊 View Activity Log
          </div>
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
