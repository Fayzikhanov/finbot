from __future__ import annotations

import logging
from pathlib import Path

from dotenv import load_dotenv

from app.bot import FamilyFinanceBot
from app.config import load_settings
from app.miniapp_server import start_miniapp_server, stop_miniapp_server


def main() -> None:
    load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    settings = load_settings()
    miniapp_server = start_miniapp_server(settings)
    bot = FamilyFinanceBot(settings)
    try:
        bot.run()
    finally:
        stop_miniapp_server(miniapp_server)


if __name__ == "__main__":
    main()
