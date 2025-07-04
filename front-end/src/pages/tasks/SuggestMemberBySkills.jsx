import React, { useState, useEffect } from "react";
import Select from "react-select";
import axios from "axios";
import { useCommon } from "../../contexts/CommonContext";

export default function SuggestMemberBySkills({
  workspaceId,
  boardId,
  startDate,
  endDate,
  onAssignSuccess,
}) {
  const { apiBaseUrl, accessToken } = useCommon();

  const [allSkills, setAllSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1) Load toàn bộ kỹ năng
  useEffect(() => {
    axios
      .get(`${apiBaseUrl}/skills`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => {
        setAllSkills(
          (res.data.skills || []).map((s) => ({
            value: s.value,
            label: s.label,
          }))
        );
      })
      .catch((err) => console.error("Không thể lấy skills:", err));
  }, [apiBaseUrl, accessToken]);

  // format ngày VN
  const formatDateVN = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("vi-VN");
  };

  // 2) Gợi ý khi nhấn nút
  const fetchSuggestions = async () => {
    setError("");
    // validate ngày
    if (!startDate || !endDate) {
      setError("Task chưa có ngày bắt đầu hoặc kết thúc.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
      return;
    }
    if (selectedSkills.length === 0) {
      setError("Vui lòng chọn ít nhất 1 kỹ năng.");
      return;
    }

    setLoading(true);
    try {
      const skillsParam = selectedSkills.map((s) => s.value).join(",");

      const res = await axios.get(
        `${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}/suggest-members`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { skills: skillsParam, startDate, endDate },
        }
      );

      const users = res.data.users || [];
      if (users.length === 0) {
        setError("Không tìm thấy thành viên phù hợp.");
      }
      setSuggestions(users);
    } catch (err) {
      console.error("Gợi ý thất bại:", err);
      setError("Có lỗi xảy ra, vui lòng thử lại.");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Hiển thị ngày của Task */}
      <div className="mb-3">
        <strong>Thời gian của nhiệm vụ này:</strong>{" "}
        <p>Ngày bắt đầu : {formatDateVN(startDate)}</p>
         <p>Ngày kết thúc :{formatDateVN(endDate)} </p>
      </div>

      {/* Chọn kỹ năng */}
      <div className="mb-3">
        <label className="form-label">Chọn kỹ năng</label>
        <Select
          isMulti
          options={allSkills}
          value={selectedSkills}
          onChange={setSelectedSkills}
          placeholder="Chọn kỹ năng..."
        />
      </div>

      {/* Nút Gợi ý */}
      <div className="mb-3">
        <button
          className="btn btn-primary"
          onClick={fetchSuggestions}
          disabled={loading}
        >
          {loading ? "Đang gợi ý…" : "Gợi ý thành viên"}
        </button>
      </div>

      {/* Thông báo lỗi */}
      {error && <div className="text-danger mb-3">{error}</div>}

      {/* Danh sách gợi ý */}
      {suggestions.length > 0 && (
        <ul className="list-group">
          {suggestions.map((u) => (
            <li
              key={u._id}
              className="list-group-item d-flex justify-content-between align-items-center"
            >
              <div className="d-flex align-items-center">
                {u.avatar && (
                  <img
                    src={u.avatar}
                    alt=""
                    className="rounded-circle me-2"
                    width={30}
                    height={30}
                  />
                )}
                <div>
                  <strong>{u.username}</strong>
                  <br />
                  <small className="text-muted">{u.email}</small>
                </div>
              </div>
              <button
                className="btn btn-sm btn-success"
                onClick={() => onAssignSuccess(u)}
              >
                Giao nhiệm vụ
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
