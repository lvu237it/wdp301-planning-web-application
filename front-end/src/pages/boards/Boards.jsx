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
                linkProps={{ to: `/workspace/${workspaceId}/boards` }}
              >
                Boards
              </Breadcrumb.Item>
              <Breadcrumb.Item active>{currentWs?.name}</Breadcrumb.Item>
            </Breadcrumb>

            {/* Title & Create Button */}
            <div className='boards-title-section'>
              <h1 className='boards-title'>Project Boards</h1>
              {isCreator && (
                <Button
                  variant='success'
                  className='btn-create-board'
                  onClick={() => setShowCreate(true)}
                >
                  + New Board
                </Button>
              )}
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

              return (
                <Col key={board._id}>
                  <Card
                    className='board-card h-100 d-flex flex-column'
                    onClick={() => navigate(`/boards/${board._id}`)}
                  >
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
                          className={`board-badge ${board.visibility}`}
                        >
                          {board.visibility}
                        </Badge>
                      </div>
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
                              className='board-member-avatar-placeholder'
                            >
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
                    <Card.Footer className='board-card-footer'>
                      <Button
                        variant='outline-primary'
                        className='board-action-btn'
                        onClick={(e) => {
                          e.stopPropagation();
                          // Logic invite
                        }}
                      >
                        Invite
                      </Button>
                      <Button
                        variant='outline-warning'
                        className='board-action-btn'
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBoard(board);
                        }}
                      >
                        Edit
                      </Button>
                    </Card.Footer>
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
