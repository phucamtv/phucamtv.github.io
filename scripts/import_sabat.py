#!/usr/bin/env python3
"""Import a Sabbath School quarter from Adventech API into Hugo content.

Usage: python3 import_sabat.py YEAR Q [lesson_n]
"""
import json
import os
import re
import subprocess
import sys
import unicodedata
import urllib.request

DAY_FILES = [
    ("01", "sa-bat.md",   "Sa-bát",     1),
    ("02", "thu-nhat.md", "Thứ Nhất",   2),
    ("03", "thu-hai.md",  "Thứ Hai",    3),
    ("04", "thu-ba.md",   "Thứ Ba",     4),
    ("05", "thu-tu.md",   "Thứ Tư",     5),
    ("06", "thu-nam.md",  "Thứ Năm",    6),
    ("07", "thu-sau.md",  "Thứ Sáu",    7),
]

VIET_MONTHS = {i: f"Tháng {i}" for i in range(1, 13)}

# Quarters whose day titles should be re-title-cased (fix lowercase đ/ơ/ă at word starts).
FIX_DAY_TITLE_CASE = {"2024-01", "2020-03", "2021-01", "2021-02", "2022-02", "2023-03"}

# Manual quarter-title overrides. Source occasionally has typos in the quarterly title.
QUARTER_TITLE_OVERRIDES = {
    "2020-03": "Kết bạn với mọi người vì danh Chúa: Chia sẻ niềm vui về sứ mệnh của Chúa",
    "2022-02": "Sáng-thế Ký: Sách của sự khởi đầu",
}


def smart_title_vi(s):
    """Capitalize the first letter of each whitespace-/punct-separated word.
    Preserves hyphens inside proper nouns (Giê-hô-va stays as-is internally)."""
    return re.sub(
        r"(?:^|(?<=[\s—:?!()/'\"“”‘’]))([a-zà-ỹ])",
        lambda m: m.group(1).upper(),
        s,
    )


# Manual title overrides by year-quarter. Source returns Title Case; we want sentence case.
LESSON_TITLE_OVERRIDES = {
    "2024-01": {
        1:  "Đọc Thi Thiên như thế nào?",
        2:  "Xin dạy chúng con cầu nguyện",
        3:  "Đức Giê-hô-va trị vì",
        4:  "Đức Giê-hô-va nghe và giải cứu",
        5:  "Hát bài ca của Đức Giê-hô-va trên đất khách",
        6:  "Ta sẽ chỗi dậy",
        7:  "Sự nhân từ Chúa lớn đến tận trời",
        8:  "Khôn ngoan để sống công bình",
        9:  "Phước cho Đấng nhân danh Chúa mà đến!",
        10: "Bài học của quá khứ",
        11: "Khao khát Chúa tại Si-ôn",
        12: "Ngợi khen Chúa không thôi",
        13: "Hãy trông đợi Đức Giê-hô-va",
    },
    "2024-02": {
        1:  "Cuộc chiến phía sau mọi cuộc chiến",
        2:  "Vấn đề trọng tâm: yêu thương hay ích kỷ?",
        3:  "Soi sáng trong nơi tối tăm",
        4:  "Đứng về phía lẽ thật",
        5:  "Niềm tin vượt mọi khó khăn",
        6:  "Hai người làm chứng",
        7:  "Được khích lệ bởi niềm hy vọng",
        8:  "Ánh sáng từ Đền Thánh",
        9:  "Nền tảng và quyền cai trị của Đức Chúa Trời",
        10: "Vong hồn hiện thuyết được phơi bày",
        11: "Những sự thử thách sắp xảy ra",
        12: "Những sự kiện cuối cùng trên đất",
        13: "Tình yêu của Chúa đã chiến thắng",
    },
    "2023-02": {
        1:  "Đức Chúa Giê-su chiến thắng - Sa-tan thất bại",
        2:  "Khoảnh khắc định mệnh",
        3:  "Tin lành đời đời",
        4:  "Kính sợ Đức Chúa Trời và tôn vinh Ngài",
        5:  "Tin lành về sự phán xét",
        6:  "Giờ phán xét của Ngài",
        7:  "Thờ phượng Đấng Tạo Hóa",
        8:  "Ngày Sa-bát và sự cuối cùng",
        9:  "Một thành loạn lạc",
        10: "Sự lừa dối cuối cùng của Sa-tan",
        11: "Ấn của Đức Chúa Trời và dấu con thú: P1",
        12: "Ấn của Đức Chúa Trời và dấu con thú: P2",
        13: "Sự vinh hiển rực rỡ của Đức Chúa Trời",
    },
    "2019-01": {
        1:  "Phúc âm từ đảo Bát-mô",
        2:  "Giữa chân đèn",
        3:  "Dân sự của Đức Chúa Trời trong các thành phố",
        4:  "Lễ đăng quang của Chiên Con",
        5:  "Bảy chiếc ấn",
        6:  "Dân sự được đóng ấn của Đức Chúa Trời",
        7:  "Bảy tiếng loa",
        8:  "Sa-tan, kẻ thù bị đánh bại",
        9:  "Sa-tan và hai liên minh của nó",
        10: "Phúc âm đời đời của Đức Chúa Trời",
        11: "Bảy bát thạnh nộ cuối cùng",
        12: "Ba-by-lôn bị phán xét",
        13: "Ta làm mới lại hết thảy muôn vật",
    },
    "2018-02": {
        1:  "Cuộc tranh đấu trên vũ trụ",
        2:  "Đa-ni-ên và thời kỳ cuối cùng",
        3:  "Đức Chúa Giê-su và Sách Khải Huyền",
        4:  "Sự cứu rỗi và kỳ sau rốt",
        5:  "Đấng Cơ-đốc trong Nơi Chí Thánh",
        6:  "Sự \"thay đổi\" của luật pháp",
        7:  "Đoạn 24 và 25 sách Ma-thi-ơ",
        8:  "Thờ phượng Đấng Tạo Hóa",
        9:  "Những sự lừa dối trong thời sau rốt",
        10: "Hoa Kỳ và Ba-by-lôn",
        11: "Ấn của Đức Chúa Trời hay dấu của con thú?",
        12: "Ba-by-lôn và Ha-ma-ghê-đôn",
        13: "Sự trở lại của Đức Chúa Giê-su, Chúa chúng ta",
    },
    "2025-03": {
        6:  "Hành trình vượt Biển Đỏ",
    },
    "2024-04": {
        1:  "Dấu lạ chỉ đường",
        2:  "Dấu hiệu của thần tánh",
        3:  "Câu chuyện ngày ấy: lời mở đầu",
        4:  "Lời chứng của Đấng Cơ-đốc như thể Đấng Mê-si",
        5:  "Lời chứng của người Sa-ma-ri",
        6:  "Nhiều lời chứng khác về Đức Chúa Giê-su",
        7:  "Phước cho những kẻ tin",
        8:  "Sự ứng nghiệm những lời tiên tri trong Cựu Ước",
        9:  "Nguồn sự sống",
        10: "Đường đi, lẽ thật và sự sống",
        11: "Đức Cha, Đức Con và Đức Thánh Linh",
        12: "Giờ vinh hiển: thập giá và sự phục sinh",
        13: "Phần kết: biết Đức Chúa Giê-su và lời của Ngài",
    },
    "2024-03": {
        1:  "Sự khởi đầu của Phúc Âm",
        2:  "Một ngày trong chức vụ của Đức Chúa Giê-su",
        3:  "Những cuộc tranh luận",
        4:  "Những dụ ngôn",
        5:  "Những phép lạ xung quanh hồ Ga-li-lê",
        6:  "Từ trong người ra",
        7:  "Dạy dỗ các môn đồ: phần 1",
        8:  "Dạy dỗ các môn đồ: phần 2",
        9:  "Sự tranh luận tại Giê-ru-sa-lem",
        10: "Những ngày sau rốt",
        11: "Hãy lấy và ăn",
        12: "Chịu thương khó và bị đóng đinh",
        13: "Chúa sống lại",
    },
    "2023-03": {
        1:  "Phao-lô và thư tín Ê-phê-sô",
        2:  "Kế hoạch vĩ đại của Đức Chúa Trời đặt Đấng Cơ-đốc làm trung tâm",
        3:  "Quyền năng cao cả của Đức Chúa Giê-su",
        4:  "Đức Chúa Trời cứu chúng ta thế nào",
        5:  "Thập giá và Hội Thánh",
        6:  "Sự mầu nhiệm của Tin Lành",
        7:  "Sự hiệp một trong thân thể Đấng Cơ-đốc",
        8:  "Lời soi dẫn bởi Thánh Linh và sống theo khuôn mẫu của Đấng Cơ-đốc",
        9:  "Sống khôn ngoan",
        10: "Các cặp vợ chồng: bên nhau nơi thập tự giá",
        11: "Thực hành lòng trung thành tuyệt đối với Đấng Cơ-đốc",
        12: "Lời kêu gọi đứng vững",
        13: "Dành lại sự bình an",
        14: "Trọng tâm của thư tín Ê-phê-sô",
    },
    "2022-02": {
        1:  "Sự sáng tạo",
        2:  "Sự sa ngã",
        3:  "Ca-in và dòng dõi ông",
        4:  "Nước lụt",
        5:  "Tháp Ba-bên và cả thế gian",
        6:  "Dòng dõi Áp-ra-ham",
        7:  "Giao ước với Áp-ra-ham",
        8:  "Lời hứa của Đức Chúa Trời",
        9:  "Gia-cốp chiếm quyền trưởng nam",
        10: "Gia-cốp – Y-sơ-ra-ên",
        11: "Giô-sép – bậc thầy của những giấc mơ",
        12: "Giô-sép – tể tướng Ai Cập",
        13: "Y-sơ-ra-ên ở Ê-díp-tô",
    },
    "2021-02": {
        1:  "Điều gì đã xảy ra?",
        2:  "Giao ước đầu tiên",
        3:  "“Trải qua các đời mãi mãi”",
        4:  "Giao ước đời đời",
        5:  "Con trẻ của lời hứa",
        6:  "Dòng dõi của Áp-ra-ham",
        7:  "Giao ước tại Si-na-i",
        8:  "Giao ước luật pháp",
        9:  "Dấu của sự giao ước",
        10: "Giao ước mới",
        11: "Giao ước mới về đền thánh",
        12: "Đức tin giao ước",
        13: "Đời sống trong giao ước mới",
    },
    "2021-01": {
        1:  "Sự khủng hoảng về bản sắc",
        2:  "Sự khủng hoảng về lãnh đạo",
        3:  "Khi thế giới riêng của bạn sụp đổ",
        4:  "Con đường gian khó",
        5:  "Chúa Bình An",
        6:  "Đức Chúa Trời hành động",
        7:  "Đánh bại người A-si-ri",
        8:  "Hãy yên ủi dân Ta",
        9:  "Phục vụ và cứu chuộc",
        10: "Làm điều không thể tưởng tượng",
        11: "Công giá của tình yêu",
        12: "Ước nguyện của các quốc gia",
        13: "Sự tái tạo địa cầu",
    },
    "2020-03": {
        1:  "Tại sao phải làm chứng?",
        2:  "Quyền năng của lời chứng cá nhân",
        3:  "Nhìn con người bằng cái nhìn của Đức Chúa Giê-su",
        4:  "Quyền năng của lời cầu nguyện: cầu thay cho người khác",
        5:  "Chứng nhân được trao quyền",
        6:  "Khả năng vô tận",
        7:  "Chia sẻ Lời Chúa",
        8:  "Phục vụ giống như Đức Chúa Giê-su",
        9:  "Phát triển thái độ tích cực",
        10: "Cách thú vị để tham gia vào nhóm nhỏ",
        11: "Chia sẻ về Đức Chúa Giê-su",
        12: "Sứ điệp cần được chia sẻ",
        13: "Bước đi trong đức tin",
    },
    "2020-02": {
        1:  "Sự độc đáo của Kinh Thánh",
        2:  "Nguồn gốc và thần tính của Kinh Thánh",
        3:  "Đức Chúa Giê-su và quan điểm của các sứ đồ về Kinh Thánh",
        4:  "Kinh Thánh nguồn có thẩm quyền thần học của chúng ta",
        5:  "Kinh Thánh là duy nhất",
        6:  "Tại sao sự diễn giải là cần thiết",
        7:  "Ngôn ngữ văn bản và ngữ cảnh",
        8:  "Sáng tạo Sáng Thế Ký là nền tảng Phần 1",
        9:  "Sự sáng tạo Sáng Thế Ký là nền tảng Phần 2",
        10: "Kinh Thánh như là lịch sử",
        11: "Kinh Thánh và lời tiên tri",
        12: "Xử lý các phân đoạn Kinh Thánh khó hiểu",
        13: "Sống bằng lời của Đức Chúa Trời",
    },
    "2019-02": {
        1:  "Nhịp điệu cuộc sống",
        2:  "Những sự chọn lựa của chúng ta",
        3:  "Chuẩn bị cho sự thay đổi",
        4:  "Khi cô đơn",
        5:  "Những lời khôn ngoan dành cho gia đình",
        6:  "Bản tình ca từ Thiên Đàng",
        7:  "Bí quyết để gia đình hiệp nhất",
        8:  "Trách nhiệm nuôi dạy con cái",
        9:  "Những thời kỳ mất mát",
        10: "Khoảnh khắc rắc rối",
        11: "Những gia đình tin kính",
        12: "Tha nhân đã thấy gì trong gia đình bạn?",
        13: "Trở lại trong thời kỳ cuối cùng",
    },
    "2018-03": {
        1:  "Các ngươi sẽ là nhân chứng cho Ta",
        2:  "Lễ Ngũ Tuần",
        3:  "Trong thời kỳ Hội Thánh ban đầu",
        4:  "Những nhà lãnh đạo Hội Thánh ban đầu",
        5:  "Sự biến đổi của Phao-lô",
        6:  "Chức vụ của Phi-e-rơ",
        7:  "Cuộc hành trình truyền giáo đầu tiên của Phao-lô",
        8:  "Hội nghị tại thành Giê-ru-sa-lem",
        9:  "Hành trình truyền giáo thứ hai",
        10: "Chuyến truyền giáo lần thứ ba",
        11: "Bị bắt tại Giê-ru-sa-lem",
        12: "Bị giam tại Sê-sa-rê",
        13: "Hành trình đến Rô-ma",
    },
    "2020-01": {
        1:  "Đọc và hiểu",
        2:  "Từ Giê-ru-sa-lem đến Ba-by-lôn",
        3:  "Từ điều kín nhiệm đến sự khải thị",
        4:  "Từ lò lửa đến hoàng cung",
        5:  "Từ kiêu ngạo đến khiêm nhường",
        6:  "Từ sự kiêu ngạo đến sự bị hủy diệt",
        7:  "Từ hang sư tử đến nơi ẩn náu của thiên sứ",
        8:  "Từ biển bão tố đến những đám mây trên trời",
        9:  "Từ ô uế đến thánh sạch",
        10: "Từ sự xưng tội đến sự an ủi",
        11: "Từ chiến đấu đến chiến thắng",
        12: "Từ bắc chí nam cho đến vùng đất xinh đẹp",
        13: "Từ bụi đất đến các vì sao",
    },
}

# Manual day title overrides by year-quarter. Source returns Title Case with broken
# Vietnamese proper-noun hyphenation and decomposed characters; we curate each.
DAY_TITLE_OVERRIDES = {
    "2025-03": {
        (6,  1): "Hành trình vượt Biển Đỏ",
        (12, 4): "Xin Cho Con Được Chiêm Ngưỡng Vinh Hiển Của Ngài!",
    },
    "2021-01": {
        (4, 7): "Nghiên Cứu Bổ Túc",
    },
    "2024-03": {
        (12, 2): "“Ấy Chính Ngươi Là Vua Dân Giu-đa Phải Không?”",
    },
    "2023-03": {
        (5,  1): "Thập Giá Và Hội Thánh",
        (5,  5): "Đức Chúa Giê-su, Đấng Rao Truyền Sự Bình An",
        (10, 1): "Các Cặp Vợ Chồng: Bên Nhau Nơi Thập Tự Giá",
    },
    "2022-02": {
        (5,  2): "Cham Bị Rủa Sả",
        (5,  3): "Gia Phổ Trong Sáng-thế Ký",
        (5,  5): "“Chúng Ta Hãy Xuống”",
        (6,  2): "Áp-ram Ra Khỏi Quê Hương",
        (7,  1): "Giao Ước Với Áp-ra-ham",
        (7,  3): "Áp-ra-ham Nghi Ngờ",
        (9,  4): "Kẻ Phỉnh Gạt Bị Lừa Gạt",
        (10, 3): "Anh Em Gặp Nhau",
        (10, 4): "Đi-na Bị Xâm Phạm",
        (12, 6): "“Tôi Là Giô-sép Em Các Anh”",
        (13, 1): "Y-sơ-ra-ên Ở Ê-díp-tô",
    },
    "2019-02": {
        (12, 1): "Tha Nhân Đã Thấy Gì Trong Gia Đình Bạn?",
        (12, 2): "Học Từ Lỗi Lầm Của Nhà Vua",
        (12, 3): "Đầu Tiên Là Người Trong Gia Đình",
        (12, 4): "Hòa Bình Thi Thắng",
        (12, 5): "Cuộc Sống Gia Đình Là Để Chia Sẻ",
        (12, 6): "Trung Tâm Của Mọi Tương Giao",
        (12, 7): "Nghiên Cứu Bổ Túc",
        (13, 1): "Trở Lại Trong Thời Kỳ Cuối Cùng",
        (13, 2): "Trở Lại Qua Lời Tiên Tri",
        (13, 3): "Trở Lại Cùng Gia Đình",
        (13, 4): "Trở Lại Tại Bàn Thờ",
        (13, 5): "Trở Lại Tại Sông Giô-đanh",
        (13, 6): "Trở Lại Trong Ngày Cuối Cùng",
        (13, 7): "Nghiên Cứu Bổ Túc",
    },
    "2023-02": {
        (1, 1): "Đức Chúa Giê-su chiến thắng - Sa-tan thất bại",
        (1, 4): "Chấp Nhận Sự Chiến Thắng Của Đức Chúa Giê-su",
        (6, 5): "Đấng Mê-si Bị Trừ Đi",
    },
    "2019-01": {
        (4,  1): "Lễ Đăng Quang Của Chiên Con",
        (4,  2): "Chúa Ngự Trên Ngai Thiên Đàng",
        (4,  3): "Hội Nghị Trên Thiên Đàng",
        (4,  4): "Quyển Sách Được Đóng Ấn",
        (4,  5): "Lễ Tấn Phong Của Chiên Con",
        (4,  6): "Ý Nghĩa Của Lễ Ngũ Tuần",
        (12, 1): "Sự Phán Xét Ba-by-lôn",
        (12, 2): "Đại Dâm Phụ Ba-by-lôn",
        (12, 3): "Đại Dâm Phụ Cưỡi Trên Con Thú",
        (12, 4): "Nhận Diện Con Thú",
        (12, 5): "Bảy Cái Đầu Của Con Thú",
        (12, 6): "Sự Sụp Đổ Của Ba-by-lôn",
        (12, 7): "Nghiên Cứu Bổ Túc",
        (13, 1): "Ta Làm Mới Lại Hết Thảy Muôn Vật",
        (13, 2): "Tiệc Cưới Chiên Con",
        (13, 3): "Hồi Kết Của Ha-ma-ghê-đôn",
        (13, 4): "Thiên Niên Kỷ",
        (13, 5): "Trời Mới Và Đất Mới",
        (13, 6): "Thành Giê-ru-sa-lem Mới",
        (13, 7): "Nghiên Cứu Bổ Túc",
    },
    "2020-01": {
        (1,  1): "Đọc Và Hiểu",
        (1,  2): "Đức Chúa Giê-su Cơ-đốc - Trọng Tâm Của Đa-ni-ên",
        (1,  3): "Cấu Trúc Của Sách Đa-ni-ên",
        (1,  4): "Lời Tiên Tri Về Sự Tận Thế Trong Sách Đa-ni-ên",
        (1,  5): "Sự Vận Hành Của Đức Chúa Trời",
        (1,  6): "Sách Đa-ni-ên Thích Hợp Với Thời Hiện Đại",
        (2,  1): "Từ Giê-ru-sa-lem Đến Ba-by-lôn",
        (2,  2): "Quyền Tể Trị Của Đức Chúa Trời",
        (2,  3): "Đức Tin Dưới Áp Lực",
        (2,  4): "Giữ Vững Quyết Tâm",
        (2,  5): "Không Tỳ Vết Và Khôn Ngoan",
        (2,  6): "Cuộc Kiểm Tra Cuối Cùng",
        (3,  1): "Từ Điều Kín Nhiệm Đến Sự Khải Thị",
        (3,  2): "Đức Chúa Trời Hiện Diện Khắp Nơi",
        (3,  3): "Lời Cầu Nguyện",
        (3,  4): "Pho Tượng Phần 1",
        (3,  5): "Pho Tượng Phần 2",
        (3,  6): "Hòn Đá",
        (4,  1): "Từ Lò Lửa Đến Hoàng Cung",
        (4,  2): "Tượng Vàng",
        (4,  3): "Sự Kêu Gọi Thờ Phượng",
        (4,  4): "Thử Lửa",
        (4,  5): "Người Thứ Tư",
        (4,  6): "Bí Quyết Của Đức Tin",
        (5,  1): "Từ Kiêu Ngạo Đến Khiêm Nhường",
        (5,  2): "Đây Chẳng Phải Là Ba-by-lôn Lớn Sao",
        (5,  3): "Nhà Tiên Tri Cảnh Báo",
        (5,  4): "Quyền Lực Tối Cao",
        (5,  5): "Ngước Mắt Lên Trời",
        (5,  6): "Khiêm Nhường Và Biết Ơn",
        (6,  1): "Từ Sự Kiêu Ngạo Đến Sự Hủy Diệt",
        (6,  2): "Bữa Tiệc Của Bên-xát-sa",
        (6,  3): "Một Vị Khách Không Mời",
        (6,  4): "Sự Xuất Hiện Của Thái Hậu",
        (6,  5): "Bị Cân Và Thấy Kém Thiếu",
        (6,  6): "Sự Sụp Đổ Của Ba-by-lôn",
        (7,  1): "Từ Hang Sư Tử Đến Nơi Ẩn Náu Của Thiên Sứ",
        (7,  2): "Những Người Đố Kỵ",
        (7,  3): "Âm Mưu Chống Lại Đa-ni-ên",
        (7,  4): "Lời Cầu Nguyện Của Đa-ni-ên",
        (7,  5): "Trong Hang Sư Tử",
        (7,  6): "Sự Biện Hộ",
        (8,  1): "Từ Biển Bão Tố Đến Những Đám Mây Trên Trời",
        (8,  2): "Bốn Con Thú",
        (8,  3): "Cái Sừng Nhỏ",
        (8,  4): "Sự Xét Đoán Đã Sắm Sẵn",
        (8,  5): "Sự Hiện Đến Của Con Người",
        (8,  6): "Các Thánh Của Đấng Rất Cao",
        (9,  1): "Từ Ô Uế Đến Thánh Sạch",
        (9,  2): "Chiên Đực Và Dê Đực",
        (9,  3): "Sự Lớn Mạnh Của Cái Sừng Nhỏ",
        (9,  4): "Sự Tấn Công Vào Đền Thánh",
        (9,  5): "Làm Sạch Đền Thánh",
        (9,  6): "Thời Điểm Tiên Tri",
        (10, 1): "Từ Việc Xưng Tội Đến Sự Khuyên Giải",
        (10, 2): "Lời Chúa Là Trọng Tâm",
        (10, 3): "Đa-ni-ên Nài Xin Sự Thương Xót",
        (10, 4): "Cầu Nguyện Cho Nhau",
        (10, 5): "Công Việc Của Đấng Mê-si",
        (10, 6): "Lịch Tiên Tri",
        (11, 1): "Từ Chiến Đấu Đến Chiến Thắng",
        (11, 2): "Kiêng Ăn Cầu Nguyện Một Lần Nữa",
        (11, 3): "Sự Hiện Thấy Của Đa-ni-ên",
        (11, 4): "Thiên Sứ Chạm Đến Đa-ni-ên",
        (11, 5): "Trận Chiến Lớn",
        (11, 6): "Vị Vua Chiến Thắng",
        (12, 1): "Từ Bắc Chí Nam Cho Đến Vùng Đất Xinh Đẹp",
        (12, 2): "Những Lời Tiên Tri Về Ba Tư Và Hy Lạp",
        (12, 3): "Những Lời Tiên Tri Về Sy-ri Và Ê-díp-tô",
        (12, 4): "La Mã Và Vua Của Giao Ước",
        (12, 5): "Quyền Lực Kế Tiếp",
        (12, 6): "Những Sự Kiện Trong Ngày Cuối Cùng",
        (13, 1): "Từ Bụi Đất Đến Các Vì Sao",
        (13, 2): "Mi-ca-ên, Hoàng Tử Của Chúng Ta",
        (13, 3): "Được Ghi Tên Trong Sách",
        (13, 4): "Sự Sống Lại",
        (13, 5): "Cuộn Sách Được Đóng Ấn",
        (13, 6): "Thời Gian Chờ Đợi",
    },
}


def _nfc(obj):
    if isinstance(obj, str):
        return unicodedata.normalize("NFC", obj)
    if isinstance(obj, dict):
        return {k: _nfc(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_nfc(x) for x in obj]
    return obj


def fetch_json(url):
    with urllib.request.urlopen(url) as r:
        data = json.loads(r.read())
    return _nfc(data)


def html_to_md(html):
    html = unicodedata.normalize("NFC", html)
    html = re.sub(r'<a[^>]*class="verse"[^>]*>(.*?)</a>', r'\1', html, flags=re.DOTALL)
    html = re.sub(r'<(h[1-6])\s+id="[^"]*">', r'<\1>', html)
    result = subprocess.run(
        ["pandoc", "-f", "html", "-t", "gfm-raw_html", "--wrap=none"],
        input=html.encode("utf-8"), capture_output=True, check=True,
    )
    md = unicodedata.normalize("NFC", result.stdout.decode("utf-8"))
    md = apply_terminology(md)
    return md.strip() + "\n"


def apply_terminology(text):
    """Apply CLAUDE.md content rules. Divine names always capitalized."""
    # Fix Ð (U+00D0 LATIN ETH) → Đ (U+0110)
    text = text.replace("Ð", "Đ")
    # Spaced proper nouns from Title-Case source: "Đa Ni Ên" → "Đa-ni-ên"
    proper_nouns = [
        ("Giê Su", "Giê-su"),
        ("Đa Ni Ên", "Đa-ni-ên"),
        ("Ba By Lôn", "Ba-by-lôn"),
        ("Ba Bi Lôn", "Ba-by-lôn"),
        ("Giê Ru Sa Lem", "Giê-ru-sa-lem"),
        ("Nê Bu Cát Nết Sa", "Nê-bu-cát-nết-sa"),
        ("Mi Ca Ên", "Mi-ca-ên"),
        ("Bên Xát Sa", "Bên-xát-sa"),
        ("Ma Thi Ơ", "Ma-thi-ơ"),
        ("Mê Si", "Mê-si"),
        ("Đa Ri Út", "Đa-ri-út"),
        ("Sy Ri", "Sy-ri"),
        ("Phi E Rơ", "Phi-e-rơ"),
        ("Ê Sai", "Ê-sai"),
        ("Ê Xê Chi Ên", "Ê-xê-chi-ên"),
        ("Ê Díp Tô", "Ê-díp-tô"),
        ("Y-Sơ-Ra-Ên", "Y-sơ-ra-ên"),
        ("Y Sơ Ra Ên", "Y-sơ-ra-ên"),
        ("Bát Mô", "Bát-mô"),
        ("Ê Phê Sô", "Ê-phê-sô"),
        ("Si Miệc Nơ", "Si-miệc-nơ"),
        ("Phi La Đen Phi", "Phi-la-đen-phi"),
        ("Bẹt Găm", "Bẹt-găm"),
        ("Thi A Ti Rơ", "Thi-a-ti-rơ"),
        ("Sạt Đe", "Sạt-đe"),
        ("Lao Đi Xê", "Lao-đi-xê"),
        ("Sa Tan", "Sa-tan"),
        ("Satan", "Sa-tan"),
        ("Ơ Phơ Rát", "Ơ-phơ-rát"),
        ("A Ma Ghê Đôn", "Ha-ma-ghê-đôn"),
        ("Christ", "Cơ-đốc"),
        ("Môi-Se", "Môi-se"),
        ("Phao Lô", "Phao-lô"),
        ("Đa Vít", "Đa-vít"),
        ("Sa Lô Môn", "Sa-lô-môn"),
        ("Ê Xê Chia", "Ê-xê-chia"),
        ("San Chê Ríp", "San-chê-ríp"),
        ("Gia Cốp", "Gia-cốp"),
    ]
    for pat, repl in proper_nouns:
        text = re.sub(re.escape(pat), repl, text)
    # Words with 2+ uppercase letters AND (non-ASCII char OR a hyphen): lowercase
    # everything after the first letter. Catches 'ĐOạn'→'Đoạn', 'ĐỨC'→'Đức',
    # 'Phi-E-Rơ'→'Phi-e-rơ', 'Si-Na-I'→'Si-na-i' (transliterated names with no
    # diacritics). ASCII acronyms (USA, BBC) are left alone because they have neither
    # a non-ASCII character nor a hyphen.
    def _fix_broken_caps(m):
        w = m.group(0)
        upper = sum(1 for c in w if c.isupper())
        if upper >= 2 and (any(ord(c) > 127 for c in w) or '-' in w):
            return w[0] + w[1:].lower()
        return w
    text = re.sub(r"[A-Za-zÀ-ỹ]+(?:-[A-Za-zÀ-ỹ]+)*", _fix_broken_caps, text)
    # Jesus references
    text = re.sub(r"[Đđ]ức [Cc]húa [Gg]iê-?[sx]u", "Đức Chúa Giê-su", text)
    text = re.sub(r"(?<![Đđ]ức )(?<![Đđ]ức )[Cc]húa [Gg]iê-?[sx]u", "Đức Chúa Giê-su", text)
    text = re.sub(r"\b[Gg]iê-[sx]u\b", "Giê-su", text)
    text = re.sub(r"\bJesus\b", "Đức Chúa Giê-su", text)
    text = re.sub(r"[Đđ]ức [Cc]húa [Tt]rời", "Đức Chúa Trời", text)
    text = re.sub(r"[Đđ]ức [Tt]hánh [Ll]inh", "Đức Thánh Linh", text)
    text = re.sub(r"[Đđ]ức [Cc]húa\b", "Đức Chúa", text)
    # Bible book names that need capitalization
    text = re.sub(r"\bThi [Tt]hiên\b", "Thi Thiên", text)
    text = re.sub(r"\bthi thiên\b", "Thi Thiên", text)
    text = re.sub(r"Thi-[Tt]hiên", "Thi Thiên", text)
    text = re.sub(r"[Kk]hải[ -][Hh]uyền", "Khải Huyền", text)
    text = re.sub(r"\bcựu ước\b", "Cựu Ước", text)
    text = re.sub(r"\btân ước\b", "Tân Ước", text)
    # Giê-hô-va: only first segment capitalized
    text = re.sub(r"Giê-[Hh]ô-[Vv]a", "Giê-hô-va", text)
    # Sa-bát: same rule (lowercase b in middle)
    text = re.sub(r"Sa-Bát", "Sa-bát", text)
    # Cơ-đốc variants
    text = re.sub(r"Đấng [Cc]ơ[ -][đĐ]ốc", "Đấng Cơ-đốc", text)
    text = re.sub(r"đấng [Cc]ơ[ -][đĐ]ốc", "Đấng Cơ-đốc", text)
    text = re.sub(r"\bcơ đốc\b", "cơ-đốc", text)
    # Đấng — divine epithet, always capitalized
    text = re.sub(r"\bđấng\b", "Đấng", text)
    replacements = [
        (r"Sabát", "Sa-bát"),
        (r"Giu-đa-izt", "Do Thái Giáo"),
        (r"Cơ Đốc", "Cơ-đốc"),
        (r"Hạt-ma-ghê-đôn", "Ha-ma-ghê-đôn"),
        (r"[Kk]inh [Tt]hánh", "Kinh Thánh"),
        (r"[Hh]ội [Tt]hánh", "Hội Thánh"),
        (r"Đọc Kinh Thánh nghiên cứu", "Kinh Thánh nghiên cứu"),
        (r"Nghiên cứu Kinh Thánh", "Kinh Thánh nghiên cứu"),
    ]
    for pat, repl in replacements:
        text = re.sub(pat, repl, text)
    # Insert missing space before "(" after a word character (e.g. "ta(Đa-ni-ên" → "ta (Đa-ni-ên")
    text = re.sub(r"([A-Za-zÀ-ỹ])\(", r"\1 (", text)
    return text


def parse_date_range(start, end):
    sd, sm, _ = start.split("/")
    ed, em, _ = end.split("/")
    sd_i, ed_i = int(sd), int(ed)
    sm_i, em_i = int(sm), int(em)
    if sm_i == em_i:
        return f"{sd_i} – {ed_i} {VIET_MONTHS[em_i]}"
    return f"{sd_i} {VIET_MONTHS[sm_i]} – {ed_i} {VIET_MONTHS[em_i]}"


def extract_scriptures_and_verse(sa_bat_html):
    html = unicodedata.normalize("NFC", sa_bat_html)
    html = re.sub(r'<a[^>]*class="verse"[^>]*>(.*?)</a>', r'\1', html, flags=re.DOTALL)
    scriptures = ""
    m = re.search(
        r'<h3[^>]*>\s*(?:Đọc\s+)?(?:Kinh\s*thánh\s*nghiên\s*cứu|Nghiên\s*cứu\s*kinh\s*thánh)\s*</h3>\s*<p>(.*?)</p>',
        html, flags=re.IGNORECASE | re.DOTALL)
    if m:
        scriptures = re.sub(r'<[^>]+>', '', m.group(1)).strip().rstrip('.').strip()
    memory_verse = ""
    memory_ref = ""
    m = re.search(r'<blockquote>(.*?)</blockquote>', html, flags=re.DOTALL)
    if m:
        bq = m.group(1)
        bq = re.sub(r'<p>\s*Câu gốc\s*</p>', '', bq, flags=re.IGNORECASE)
        bq_text = re.sub(r'<[^>]+>', '', bq).strip()
        rm = re.search(r'^(.*?)\s*\(([^)]+)\)\s*\.?\s*$', bq_text, flags=re.DOTALL)
        if rm:
            memory_verse = rm.group(1).strip()
            memory_ref = rm.group(2).strip()
        else:
            rm = re.search(
                r'^(.+?["”])[\s\.\—\-—,]+([\w\s\-\.,:;À-ỹ]+?)\.?\s*$',
                bq_text, flags=re.DOTALL)
            if rm:
                memory_verse = rm.group(1).strip()
                memory_ref = rm.group(2).strip().rstrip('.')
            else:
                memory_verse = bq_text
    return scriptures, memory_verse, memory_ref


def yaml_escape(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')


def write_lesson(year, q, n, base_url, out_root, title_override=None):
    lesson_dir = os.path.join(out_root, f"bai-{n}")
    os.makedirs(lesson_dir, exist_ok=True)

    lesson_idx = fetch_json(f"{base_url}/lessons/{n:02d}/index.json")
    days = lesson_idx["days"]
    lesson_info = lesson_idx["lesson"]
    date_range = parse_date_range(lesson_info["start_date"], lesson_info["end_date"])

    title = title_override or apply_terminology(lesson_info["title"])

    day_contents = []
    for i in range(7):
        d = days[i]
        url = f"https://sabbath-school.adventech.io/api/v2/{d['read_path']}/index.json"
        day_contents.append(fetch_json(url))

    sa_bat_html = day_contents[0]["content"]
    scriptures, memory_verse, memory_ref = extract_scriptures_and_verse(sa_bat_html)
    if scriptures:
        scriptures = apply_terminology(scriptures)
    if memory_verse:
        memory_verse = apply_terminology(memory_verse)
    if memory_ref:
        memory_ref = apply_terminology(memory_ref)

    index_path = os.path.join(lesson_dir, "_index.md")
    parts = [
        "---",
        f'title: "{yaml_escape(title)}"',
        "layout: lesson",
        f"lesson: {n}",
        f"weight: {n}",
        f'dateRange: "{date_range}"',
    ]
    if scriptures:
        parts.append(f'scriptures: "{yaml_escape(scriptures)}"')
    if memory_verse:
        mv = memory_verse.strip().lstrip('“"').rstrip('”"').strip()
        parts.append(f"memoryVerse: '\"{mv}\"'")
    if memory_ref:
        parts.append(f'memoryVerseRef: "{yaml_escape(memory_ref)}"')
    parts.append("---")
    parts.append("")
    with open(index_path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))

    day_overrides = DAY_TITLE_OVERRIDES.get(f"{year}-{q:02d}", {})
    for i, (day_id, fname, day_label, weight) in enumerate(DAY_FILES):
        content_html = day_contents[i]["content"]
        day_idx = i + 1  # 1=Sa-bát ... 7=Thứ Sáu
        if (n, day_idx) in day_overrides:
            day_title = day_overrides[(n, day_idx)]
        else:
            raw_title = day_contents[i]["title"] or ""
            # All-caps source titles: lowercase then re-Title-Case before terminology rules.
            if raw_title and raw_title.upper() == raw_title and any(c.isalpha() for c in raw_title):
                raw_title = smart_title_vi(raw_title.lower())
            day_title = apply_terminology(raw_title)
            if f"{year}-{q:02d}" in FIX_DAY_TITLE_CASE:
                # Re-apply terminology after smart_title_vi so case-sensitive rules
                # (e.g. 'Cơ Đốc' → 'Cơ-đốc') fire on the newly-capitalized form.
                day_title = apply_terminology(smart_title_vi(day_title)).strip()
                # Strip outer quotes only when both ends are quotes (entire title wrapped).
                if len(day_title) >= 2 and day_title[0] in '“”"' and day_title[-1] in '“”"':
                    day_title = day_title[1:-1].strip()
        body_md = html_to_md(content_html)
        if day_label == "Thứ Sáu" and "NGHIÊN CỨU BỔ TÚC" not in body_md.upper():
            body_md = "NGHIÊN CỨU BỔ TÚC\n\n" + body_md
        day_path = os.path.join(lesson_dir, fname)
        header = [
            "---",
            "build: { render: never }",
            f'title: "{yaml_escape(day_title)}"',
            f'dayLabel: "{day_label}"',
            f"weight: {weight}",
            "---",
            "",
        ]
        with open(day_path, "w", encoding="utf-8") as f:
            f.write("\n".join(header))
            f.write(body_md)

    print(f"  bai-{n}: {title} ({date_range})")


def write_quarter_index(year, q, quarter_info, out_dir):
    key = f"{year}-{q:02d}"
    title = QUARTER_TITLE_OVERRIDES.get(key) or apply_terminology(quarter_info["title"])
    content = f'''---
title: "Quý {q}, {year} – {title}"
layout: quarter
weight: {q}
source: "Adventech"
sourceUrl: "https://sabbath-school.adventech.io/vi/{year}-{q:02d}"
---
'''
    with open(os.path.join(out_dir, "_index.md"), "w", encoding="utf-8") as f:
        f.write(content)


def write_year_index(year, out_dir):
    path = os.path.join(out_dir, "_index.md")
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(f'---\ntitle: "{year}"\n---\n')


def main():
    if len(sys.argv) < 3:
        print("Usage: import_sabat.py YEAR Q [lesson_n]")
        sys.exit(1)
    year = int(sys.argv[1])
    q = int(sys.argv[2])
    only = int(sys.argv[3]) if len(sys.argv) > 3 else None

    base_url = f"https://sabbath-school.adventech.io/api/v2/vi/quarterlies/{year}-{q:02d}"
    out_year = f"/Users/htruong/code/phucamtv/content/truong-sabat/{year}"
    out_q = os.path.join(out_year, f"q{q}")
    os.makedirs(out_q, exist_ok=True)

    qinfo = fetch_json(f"{base_url}/index.json")
    write_year_index(year, out_year)
    write_quarter_index(year, q, qinfo["quarterly"], out_q)

    overrides = LESSON_TITLE_OVERRIDES.get(f"{year}-{q:02d}", {})
    for lesson in qinfo["lessons"]:
        n = int(lesson["id"])
        if only is not None and n != only:
            continue
        write_lesson(year, q, n, base_url, out_q, overrides.get(n))


if __name__ == "__main__":
    main()
