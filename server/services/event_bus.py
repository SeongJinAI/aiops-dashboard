"""
EventBus — 인프로세스 pub/sub (SaaS 모드 실시간 WebSocket용)

ingest API가 publish() → 해당 tenant의 WebSocket 구독자들에게 전달
watchfiles를 대체한다.
"""
import asyncio


class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[asyncio.Queue]] = {}

    async def publish(self, tenant_id: str, category: str, payload: dict):
        """특정 tenant의 모든 구독자에게 메시지를 전달한다."""
        msg = {"category": category, **payload}
        for queue in self._subscribers.get(tenant_id, []):
            try:
                queue.put_nowait(msg)
            except asyncio.QueueFull:
                pass  # 큐가 가득 차면 드롭 (느린 클라이언트 보호)

    async def subscribe(self, tenant_id: str) -> asyncio.Queue:
        """tenant에 대한 구독을 시작하고 메시지 큐를 반환한다."""
        if tenant_id not in self._subscribers:
            self._subscribers[tenant_id] = []
        queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subscribers[tenant_id].append(queue)
        return queue

    def unsubscribe(self, tenant_id: str, queue: asyncio.Queue):
        """구독을 해제한다."""
        if tenant_id in self._subscribers:
            try:
                self._subscribers[tenant_id].remove(queue)
            except ValueError:
                pass
            if not self._subscribers[tenant_id]:
                del self._subscribers[tenant_id]

    @property
    def subscriber_count(self) -> int:
        return sum(len(qs) for qs in self._subscribers.values())


# 싱글턴 인스턴스
event_bus = EventBus()
