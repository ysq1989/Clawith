"""Xiaohongshu (小红书) operations module — SQLAlchemy models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class XHSAccount(Base):
    """小红书账号"""

    __tablename__ = "xhs_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    alias = Column(String(200))
    xhs_user_id = Column(String(100))
    cookie_encrypted = Column(Text)
    status = Column(String(20), default="active")  # active / inactive / expired
    last_login_at = Column(DateTime)
    last_health_check_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contents = relationship("XHSContent", back_populates="account")


class XHSPersona(Base):
    """小红书账号人设"""

    __tablename__ = "xhs_personas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    tone = Column(String(100))  # 语气风格
    topics = Column(JSONB)  # 擅长领域
    avoid_words = Column(JSONB)  # 禁用词
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class XHSContent(Base):
    """小红书内容（草稿/已发布/排期中）"""

    __tablename__ = "xhs_content"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("xhs_accounts.id"))
    persona_id = Column(UUID(as_uuid=True), ForeignKey("xhs_personas.id"))

    title = Column(String(200), nullable=False)
    content = Column(Text)
    note_type = Column(String(20), default="image")  # image / video
    images = Column(JSONB)  # [{url, local_path}]
    video_url = Column(String(500))
    tags = Column(JSONB)  # ["#tag1", "#tag2"]

    status = Column(String(20), default="draft")  # draft / scheduled / publishing / published / failed
    scheduled_at = Column(DateTime)
    published_at = Column(DateTime)
    xhs_note_id = Column(String(100))  # 发布后的小红书笔记 ID
    publish_log = Column(Text)  # 发布日志/错误信息

    ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("XHSAccount", back_populates="contents")


class XHSPublishLog(Base):
    """发布记录"""

    __tablename__ = "xhs_publish_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    content_id = Column(UUID(as_uuid=True), ForeignKey("xhs_content.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("xhs_accounts.id"))
    status = Column(String(20), nullable=False)  # success / failed
    error_message = Column(Text)
    published_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class XHSNoteAnalytics(Base):
    """笔记数据分析快照"""

    __tablename__ = "xhs_note_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    note_id = Column(String(100), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("xhs_accounts.id"))

    title = Column(String(200))
    author_id = Column(String(100))
    author_name = Column(String(200))

    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    bookmarks = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    followers_gained = Column(Integer, default=0)

    collected_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class XHSSchedule(Base):
    """排期队列"""

    __tablename__ = "xhs_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    content_id = Column(UUID(as_uuid=True), ForeignKey("xhs_content.id"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("xhs_accounts.id"), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending")  # pending / processing / completed / failed
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class XHSKnowledge(Base):
    """知识库"""

    __tablename__ = "xhs_knowledge"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # pattern / account / topic / action
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)  # markdown
    metadata_ = Column("metadata", JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)
