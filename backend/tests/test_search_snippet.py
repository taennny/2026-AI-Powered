"""목록 미리보기 — 검색어가 본문에 있으면 그 주변을 잘라 보여준다."""

from app.services.blog import SUMMARY_LENGTH, build_summary

LONG = "가" * 200 + "카페" + "나" * 200


def test_no_query_shows_beginning():
    """검색어가 없으면 기존처럼 앞부분"""
    result = build_summary(LONG)
    assert result.startswith("가")
    assert result.endswith("…")
    assert len(result) == SUMMARY_LENGTH + 1  # 뒤 말줄임표


def test_match_in_middle_is_centered():
    """본문 중간의 검색어가 미리보기에 보인다 (앞뒤 말줄임표)"""
    result = build_summary(LONG, "카페")
    assert "카페" in result
    assert result.startswith("…")
    assert result.endswith("…")


def test_match_at_start_has_no_leading_ellipsis():
    """검색어가 맨 앞이면 앞 말줄임표 없음"""
    result = build_summary("카페에서 " + "가" * 300, "카페")
    assert result.startswith("카페")
    assert not result.startswith("…")


def test_match_at_end_keeps_length():
    """검색어가 끝쪽이어도 길이를 채우고 뒤 말줄임표는 없다"""
    content = "가" * 300 + "카페"
    result = build_summary(content, "카페")
    assert result.endswith("카페")
    assert not result.endswith("…")
    assert len(result) == SUMMARY_LENGTH + 1  # 앞 말줄임표


def test_query_not_in_content_falls_back():
    """제목·날짜로만 매치된 경우(본문에 검색어 없음)는 앞부분"""
    result = build_summary(LONG, "26.08.06")
    assert result.startswith("가")


def test_case_insensitive():
    """대소문자 무시 — 검색 조건(ilike)과 동일하게"""
    result = build_summary("x" * 200 + "Cafe latte" + "y" * 200, "cafe")
    assert "Cafe" in result


def test_short_content_unchanged():
    """짧은 본문은 그대로, 말줄임표 없음"""
    result = build_summary("짧은 글")
    assert result == "짧은 글"


def test_empty_content():
    assert build_summary(None) is None
    assert build_summary("") is None
